import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { DataSource, EntityManager, FindOptionsWhere, In } from 'typeorm';
import { errorCode } from '@/common/utils/error.util';
import { fromCents, toCents } from '@/common/utils/money.util';
import { BotEventsService } from '@/modules/bot-events/bot-events.service';
import { Branch } from '@/modules/branches/entities/branch.entity';
import { acceptedTable } from '@/modules/branches/utils/table.util';
import {
  WalletMovementType,
  WalletUse,
} from '@/modules/customers/enums/customer.enums';
import { RestaurantCustomersService } from '@/modules/customers/services/restaurant-customers.service';
import { normalizePhone } from '@/modules/customers/utils/phone.util';
import { MenuItem } from '@/modules/menus/entities/menu-item.entity';
import { NotificationType } from '@/modules/notifications/enums/notification-type.enum';
import { OrdersGateway } from '@/modules/notifications/gateways/orders.gateway';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { OrderItem } from '@/modules/orders/entities/order-item.entity';
import { OrderRound } from '@/modules/orders/entities/order-round.entity';
import { Order } from '@/modules/orders/entities/order.entity';
import { Payment } from '@/modules/orders/entities/payment.entity';
import { BranchOrdering } from '@/modules/ordering/entities/branch-ordering.entity';
import {
  ACTIVE_ORDER_STATUSES,
  FulfillmentStatus,
  OPEN_FULFILLMENT_STATUSES,
  OrderSource,
  OrderStatus,
  OrderType,
  PaymentMethod,
  PaymentStatus,
  RoundStatus,
} from '@/modules/orders/enums/order.enums';
import {
  billMessage,
  dailyCloseMessage,
  paidOrderCancelledMessage,
  payWithWaiterMessage,
  roundMessage,
} from '@/modules/orders/utils/order-messages.util';

const UNIQUE_VIOLATION = '23505';

export interface RoundItemInput {
  menuItemId: string;
  quantity: number;
  note?: string;
}

export interface DeliveryInput {
  address: string;
  references?: string;
  latitude: number;
  longitude: number;
  fee: number;
}

export interface OpenAccountInput {
  branchId: string;
  /** Lo genera el mesero; las cuentas del personal lo reciben aquí. */
  code?: string;
  source: OrderSource;
  /** Sin tipo es una cuenta de mesa. */
  type?: OrderType;
  /** Solo las cuentas de mesa la llevan. */
  table?: string;
  scheduledFor?: string;
  delivery?: DeliveryInput;
  commissionPct?: number;
  customerName?: string;
  phone?: string;
  language?: string;
  locationVerified?: boolean;
  afterPreviousBill?: boolean;
  items: RoundItemInput[];
}

export interface RoundResult {
  order: Order;
  round: OrderRound;
  /** false: era un reintento y no se creó nada. */
  created: boolean;
}

export interface BotOrderUpdate {
  status: OrderStatus;
  walletUse?: WalletUse;
  walletAmount?: number;
  tip?: number;
  /** Con `payment_link`: la comisión con que el bot generó el link. */
  commissionPct?: number;
}

export interface CancelPaidResult {
  order: Order;
  /** El pago a reembolsar. null si no se encontró. */
  payment: Payment | null;
}

export interface BotOrderResult {
  order: Order;
  /** Saldo que le queda al comensal. Vacío si la cuenta no tiene cliente. */
  walletBalance: number | null;
  /** Pidió más saldo del que tiene. */
  walletCapped: boolean;
}

/** A dónde puede avanzar el bot una cuenta. */
export const BOT_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  [OrderStatus.OPEN]: [OrderStatus.BILL_REQUESTED],
  [OrderStatus.BILL_REQUESTED]: [
    OrderStatus.PAYMENT_LINK,
    OrderStatus.WITH_WAITER,
  ],
  [OrderStatus.PAYMENT_LINK]: [OrderStatus.WITH_WAITER],
  [OrderStatus.WITH_WAITER]: [OrderStatus.PAYMENT_LINK],
};

/**
 * Recoger y domicilio: el monedero se aplica al salir de `open` y el bot los
 * cancela mientras no se paguen (link vencido o carrito cambiado).
 */
export const ORDERING_BOT_TRANSITIONS: Partial<
  Record<OrderStatus, OrderStatus[]>
> = {
  [OrderStatus.OPEN]: [
    OrderStatus.BILL_REQUESTED,
    OrderStatus.PAYMENT_LINK,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.BILL_REQUESTED]: [
    OrderStatus.PAYMENT_LINK,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.PAYMENT_LINK]: [OrderStatus.CANCELLED],
};

const DELIVERY_STEPS = [
  FulfillmentStatus.ON_THE_WAY,
  FulfillmentStatus.DELIVERED,
];
const PICKUP_STEPS = [FulfillmentStatus.READY, FulfillmentStatus.DELIVERED];

/** A dónde avanza la entrega. "En preparación" se puede saltar. */
export const fulfillmentTransitions = (
  type: OrderType,
  from: FulfillmentStatus,
): FulfillmentStatus[] => {
  const [handOff, delivered] =
    type === OrderType.DELIVERY ? DELIVERY_STEPS : PICKUP_STEPS;

  switch (from) {
    case FulfillmentStatus.PENDING:
      return [FulfillmentStatus.PREPARING, handOff];
    case FulfillmentStatus.PREPARING:
      return [handOff];
    case FulfillmentStatus.ON_THE_WAY:
    case FulfillmentStatus.READY:
      return from === handOff ? [delivered] : [];
    default:
      return [];
  }
};

export type FulfillmentOrigin = 'bot' | 'panel';

export const ROUND_TRANSITIONS: Record<RoundStatus, RoundStatus[]> = {
  [RoundStatus.NEW]: [
    RoundStatus.PREPARING,
    RoundStatus.DELIVERED,
    RoundStatus.CANCELLED,
  ],
  [RoundStatus.PREPARING]: [RoundStatus.DELIVERED, RoundStatus.CANCELLED],
  [RoundStatus.DELIVERED]: [],
  [RoundStatus.CANCELLED]: [],
};

/** Lo que solo aplica a recoger y domicilio, o solo a domicilio. */
const assertOrderInput = (type: OrderType, input: OpenAccountInput): void => {
  const isOrdering = type !== OrderType.DINE_IN;

  if (
    !isOrdering &&
    (input.scheduledFor || input.commissionPct !== undefined)
  ) {
    throw new BadRequestException(
      'scheduledFor and commissionPct are only for pickup and delivery',
    );
  }
  if ((type === OrderType.DELIVERY) !== Boolean(input.delivery)) {
    throw new BadRequestException(
      'delivery is required for delivery orders, and only for them',
    );
  }
};

/** Código de las cuentas que abre el personal. Las del mesero empiezan con C. */
const generateStaffCode = (): string =>
  `S${randomBytes(5).toString('hex').toUpperCase()}`;

/**
 * Ciclo de vida de una cuenta. Toda escritura va en una transacción que bloquea
 * la fila de la cuenta: dos rondas simultáneas no pueden dejar mal el total.
 */
@Injectable()
export class OrderAccountsService {
  private readonly logger = new Logger(OrderAccountsService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly notificationsService: NotificationsService,
    private readonly ordersGateway: OrdersGateway,
    private readonly botEventsService: BotEventsService,
    private readonly customers: RestaurantCustomersService,
  ) {}

  /** Abre la cuenta con su primera ronda. Reintentar con el mismo código no duplica. */
  async openAccount(input: OpenAccountInput): Promise<RoundResult> {
    const code = input.code ?? generateStaffCode();
    const type = input.type ?? OrderType.DINE_IN;
    const isOrdering = type !== OrderType.DINE_IN;
    assertOrderInput(type, input);

    let result: RoundResult;
    try {
      result = await this.dataSource.transaction(async (manager) => {
        const existing = await manager.findOne(Order, { where: { code } });
        if (existing) return this.replay(manager, existing, input.branchId);

        const tableLabel = isOrdering
          ? await this.assertOrderingType(manager, input.branchId, type)
          : await this.acceptTable(manager, input.branchId, input.table ?? '');

        const order = await manager.save(
          manager.create(Order, {
            code,
            branchId: input.branchId,
            source: input.source,
            type,
            tableLabel,
            scheduledFor: input.scheduledFor
              ? new Date(input.scheduledFor)
              : null,
            deliveryAddress: input.delivery?.address.trim() ?? null,
            deliveryReferences: input.delivery?.references?.trim() || null,
            deliveryLatitude: input.delivery?.latitude ?? null,
            deliveryLongitude: input.delivery?.longitude ?? null,
            deliveryFee: input.delivery?.fee ?? 0,
            commissionPct: input.commissionPct ?? null,
            customerName: input.customerName || null,
            language: input.language ?? 'es',
            locationVerified: input.locationVerified ?? false,
            customerId: input.phone
              ? await this.customers.upsertCustomer(
                  manager,
                  input.phone,
                  input.customerName,
                )
              : null,
          }),
        );

        // En recoger y domicilio la visita se cuenta al pagar.
        if (order.customerId) {
          await this.customers.registerVisit(
            manager,
            input.branchId,
            order.customerId,
            !isOrdering && !input.afterPreviousBill,
          );
        }

        const round = await this.createRound(manager, order, 1, input.items);
        const updated = await this.refreshTotals(manager, order.id);

        return { order: updated, round, created: true };
      });
    } catch (error) {
      if (errorCode(error) !== UNIQUE_VIOLATION) throw error;
      // Otro reintento ganó la carrera: se responde con lo que ya existe.
      result = await this.dataSource.transaction(async (manager) => {
        const order = await manager.findOneByOrFail(Order, { code });
        return this.replay(manager, order, input.branchId);
      });
    }

    // Caja se entera de un pedido hasta que se paga.
    if (result.created && !isOrdering) {
      await this.announceRound(result, {
        phone: input.phone,
        locationUnverified:
          input.source === OrderSource.WHATSAPP && !input.locationVerified,
        afterPreviousBill: input.afterPreviousBill,
      });
    }

    return result;
  }

  /** Cuenta que abre el personal desde el panel. */
  openStaffTab(input: {
    branchId: string;
    table: string;
    customerName?: string;
    items: RoundItemInput[];
  }): Promise<RoundResult> {
    return this.openAccount({
      ...input,
      source: OrderSource.STAFF,
      locationVerified: true,
    });
  }

  /** Ronda del bot. `number` es su contador: reintentarla no duplica la comanda. */
  async addBotRound(
    branchId: string,
    code: string,
    number: number,
    items: RoundItemInput[],
  ): Promise<RoundResult> {
    const result = await this.dataSource.transaction(async (manager) => {
      const order = await this.lockOrder(manager, { code, branchId });

      const existing = await this.findRound(manager, order.id, number);
      if (existing) return { order, round: existing, created: false };

      return this.addRoundTo(manager, order, number, items);
    });

    if (result.created && result.order.type === OrderType.DINE_IN) {
      await this.announceRound(result);
    }

    return result;
  }

  /** Ronda del personal. Solo en sus cuentas: el bot numera las de WhatsApp. */
  async addStaffRound(
    orderId: string,
    items: RoundItemInput[],
  ): Promise<RoundResult> {
    const result = await this.dataSource.transaction(async (manager) => {
      const order = await this.lockOrder(manager, { id: orderId });

      if (order.source !== OrderSource.STAFF) {
        throw new ConflictException(
          'WhatsApp accounts receive rounds from the bot',
        );
      }

      const last = await manager.maximum(OrderRound, 'number', { orderId });

      return this.addRoundTo(manager, order, (last ?? 0) + 1, items);
    });

    await this.announceRound(result);

    return result;
  }

  /**
   * Avance que informa el bot. Repetir el estado actual no vuelve a descontar el
   * monedero; solo actualiza la propina si cambió antes de generar el link.
   */
  async updateFromBot(
    branchId: string,
    code: string,
    update: BotOrderUpdate,
  ): Promise<BotOrderResult> {
    const { status } = update;
    const { order, changed, walletCapped } = await this.dataSource.transaction(
      async (manager) => {
        const locked = await this.lockOrder(manager, { code, branchId });

        if (locked.status === status) {
          // Un link nuevo puede cambiar la propina o la comisión.
          if (
            status === OrderStatus.PAYMENT_LINK &&
            (update.tip !== undefined || update.commissionPct !== undefined)
          ) {
            if (update.tip !== undefined) locked.tip = update.tip;
            if (update.commissionPct !== undefined) {
              locked.commissionPct = update.commissionPct;
            }
            await manager.save(locked);
          }
          return { order: locked, changed: false, walletCapped: false };
        }

        const isOrdering = locked.type !== OrderType.DINE_IN;
        const transitions = isOrdering
          ? ORDERING_BOT_TRANSITIONS
          : BOT_TRANSITIONS;

        if (!transitions[locked.status]?.includes(status)) {
          throw new ConflictException(
            `The account cannot go from ${locked.status} to ${status}`,
          );
        }

        // Mesa: al pedir la cuenta. Pedidos: al salir de `open`.
        const appliesWallet = isOrdering
          ? locked.status === OrderStatus.OPEN &&
            status !== OrderStatus.CANCELLED
          : status === OrderStatus.BILL_REQUESTED;

        locked.status = status;
        let walletCapped = false;
        if (status === OrderStatus.BILL_REQUESTED) {
          locked.billRequestedAt = new Date();
        }
        if (appliesWallet) {
          walletCapped = await this.useWallet(manager, locked, update);
        }
        if (status === OrderStatus.CANCELLED) {
          locked.closedAt = new Date();
          await this.returnWallet(
            manager,
            locked,
            toCents(locked.walletDiscount),
            'Pedido cancelado',
          );
        }
        if (status === OrderStatus.WITH_WAITER) {
          locked.paymentMethod = PaymentMethod.WAITER;
          // La propina solo se conoce con el link.
          locked.tip = 0;
        }
        if (status === OrderStatus.PAYMENT_LINK) {
          locked.paymentMethod = PaymentMethod.MERCADO_PAGO;
          locked.tip = update.tip ?? 0;
          if (update.commissionPct !== undefined) {
            locked.commissionPct = update.commissionPct;
          }
        }

        return {
          order: await manager.save(locked),
          changed: true,
          walletCapped,
        };
      },
    );

    if (changed && order.type === OrderType.DINE_IN) {
      await this.announceStatus(order);
    } else if (changed) {
      this.ordersGateway.emitOrderUpdate(order.branchId);
    }

    return {
      order,
      walletBalance: await this.customers.balanceOf(
        order.branchId,
        order.customerId,
      ),
      walletCapped,
    };
  }

  /**
   * Avance de la entrega de un pedido pagado. Repetir el estado actual no hace
   * nada. Si lo cambia el panel, se le avisa al bot para que avise al cliente.
   */
  async updateFulfillment(
    where: FindOptionsWhere<Order>,
    status: FulfillmentStatus,
    origin: FulfillmentOrigin,
  ): Promise<Order> {
    const { order, changed } = await this.dataSource.transaction(
      async (manager) => {
        const locked = await this.lockOrder(manager, where);

        if (!locked.fulfillmentStatus) {
          throw new ConflictException(
            locked.type === OrderType.DINE_IN
              ? 'Only pickup and delivery orders have a delivery status'
              : 'The order is not paid yet',
          );
        }

        if (locked.fulfillmentStatus === status) {
          return { order: locked, changed: false };
        }

        if (
          !fulfillmentTransitions(
            locked.type,
            locked.fulfillmentStatus,
          ).includes(status)
        ) {
          throw new ConflictException(
            `The order cannot go from ${locked.fulfillmentStatus} to ${status}`,
          );
        }

        locked.fulfillmentStatus = status;
        locked.fulfillmentUpdatedAt = new Date();

        return { order: await manager.save(locked), changed: true };
      },
    );

    if (changed) {
      this.ordersGateway.emitOrderUpdate(order.branchId);

      if (origin === 'panel') {
        this.botEventsService.emit(
          order.branchId,
          'order.fulfillment_changed',
          {
            orderCode: order.code,
            orderType: order.type,
            fulfillmentStatus: order.fulfillmentStatus,
            language: order.language,
            phone: await this.customers.phoneOf(order.customerId),
          },
        );
      }
    }

    return order;
  }

  /** Caja cambia el estado de una comanda. */
  async updateRoundStatus(
    roundId: string,
    status: RoundStatus,
  ): Promise<OrderRound> {
    const { order, round } = await this.dataSource.transaction(
      async (manager) => {
        const current = await manager.findOneBy(OrderRound, { id: roundId });
        if (!current) throw new NotFoundException('Round not found');

        const locked = await this.lockOrder(manager, { id: current.orderId });

        // Se vuelve a leer con la cuenta bloqueada.
        const fresh = await manager.findOneByOrFail(OrderRound, {
          id: roundId,
        });

        // Pagada puede seguir en cocina, pero cancelar ya sería un reembolso.
        const stillServing =
          locked.status === OrderStatus.PAID &&
          status !== RoundStatus.CANCELLED;

        if (!ACTIVE_ORDER_STATUSES.includes(locked.status) && !stillServing) {
          throw new ConflictException('The account is closed');
        }

        if (!ROUND_TRANSITIONS[fresh.status].includes(status)) {
          throw new ConflictException(
            `The round cannot go from ${fresh.status} to ${status}`,
          );
        }

        fresh.status = status;
        if (status === RoundStatus.PREPARING) fresh.acknowledgedAt = new Date();
        if (status === RoundStatus.DELIVERED) {
          fresh.acknowledgedAt ??= new Date();
          fresh.deliveredAt = new Date();
        }

        await manager.save(fresh);

        const updated =
          status === RoundStatus.CANCELLED
            ? await this.refreshAfterCancellation(manager, locked.id)
            : locked;

        return { order: updated, round: fresh };
      },
    );

    this.ordersGateway.emitOrderUpdate(order.branchId);

    if (order.source === OrderSource.WHATSAPP) {
      this.botEventsService.emit(order.branchId, 'round.status_changed', {
        orderCode: order.code,
        roundNumber: round.number,
        status: round.status,
        table: order.tableLabel,
        language: order.language,
        phone: await this.customers.phoneOf(order.customerId),
      });
    }

    return round;
  }

  /** Caja da la cuenta por cobrada. */
  settle(orderId: string): Promise<Order> {
    return this.close(orderId, OrderStatus.SETTLED);
  }

  cancel(orderId: string): Promise<Order> {
    return this.close(orderId, OrderStatus.CANCELLED);
  }

  /**
   * El dueño cancela un pedido de recoger o domicilio ya pagado y sin entregar.
   * Devuelve el saldo que se usó, quita el cashback que ganó (sin dejar el saldo
   * en negativo) y avisa a caja y al bot. El reembolso en Mercado Pago lo hace
   * caja a mano mientras el bot no lo haga solo.
   */
  async cancelPaidOrder(orderId: string): Promise<CancelPaidResult> {
    const result = await this.dataSource.transaction(async (manager) => {
      const locked = await this.lockOrder(manager, { id: orderId });

      if (
        locked.type === OrderType.DINE_IN ||
        locked.status !== OrderStatus.PAID ||
        !locked.fulfillmentStatus ||
        !OPEN_FULFILLMENT_STATUSES.includes(locked.fulfillmentStatus)
      ) {
        throw new ConflictException(
          'Only paid pickup and delivery orders that were not delivered can be cancelled',
        );
      }

      const payment = await manager.findOne(Payment, {
        where: { orderId: locked.id, status: PaymentStatus.APPROVED },
        order: { paidAt: 'DESC' },
      });

      await this.undoWallet(manager, locked, payment);

      locked.status = OrderStatus.CANCELLED;
      locked.fulfillmentStatus = FulfillmentStatus.CANCELLED;
      locked.fulfillmentUpdatedAt = new Date();

      return { order: await manager.save(locked), payment };
    });

    const { order, payment } = result;
    const phone = await this.customers.phoneOf(order.customerId);

    await this.notificationsService.create({
      branchId: order.branchId,
      type: NotificationType.ALERT,
      message: paidOrderCancelledMessage(order, payment),
      phoneNumber: phone ?? undefined,
      orderId: order.id,
    });
    this.ordersGateway.emitOrderUpdate(order.branchId);
    this.botEventsService.emit(order.branchId, 'order.cancelled', {
      orderCode: order.code,
      orderType: order.type,
      language: order.language,
      phone,
      refundAmount: payment ? Number(payment.paidAmount) : 0,
      providerPaymentId: payment?.providerPaymentId ?? null,
    });

    return result;
  }

  /**
   * Cierre diario: el mesero borra esa noche las sesiones, así que nadie pedirá esas
   * cuentas. Solo las de WhatsApp sin cuenta pedida: las que ya tienen un cobro en
   * curso y las del personal las cierra caja.
   */
  async closeDay(branchId: string): Promise<Order[]> {
    const orders = await this.dataSource.transaction(async (manager) => {
      const open = await manager.find(Order, {
        // Los pedidos sin pagar los cancela el bot cuando vence su link.
        where: {
          branchId,
          status: OrderStatus.OPEN,
          source: OrderSource.WHATSAPP,
          type: OrderType.DINE_IN,
        },
        lock: { mode: 'pessimistic_write' },
      });
      const closedAt = new Date();

      return manager.save(
        open.map((order) =>
          Object.assign(order, { status: OrderStatus.AUTO_CLOSED, closedAt }),
        ),
      );
    });

    if (orders.length > 0) {
      await this.notificationsService.create({
        branchId,
        type: NotificationType.ALERT,
        message: dailyCloseMessage(orders),
      });
      this.ordersGateway.emitOrderUpdate(branchId);
    }

    return orders;
  }

  private async close(orderId: string, status: OrderStatus): Promise<Order> {
    const order = await this.dataSource.transaction(async (manager) => {
      const locked = await this.lockOrder(manager, { id: orderId });

      if (!ACTIVE_ORDER_STATUSES.includes(locked.status)) {
        throw new ConflictException('The account is already closed');
      }

      locked.status = status;
      locked.closedAt = new Date();
      if (status === OrderStatus.SETTLED) {
        locked.paymentMethod ??= PaymentMethod.WAITER;
      }
      if (status === OrderStatus.CANCELLED) {
        await this.returnWallet(
          manager,
          locked,
          toCents(locked.walletDiscount),
          'Cuenta cancelada',
        );
      }

      return manager.save(locked);
    });

    this.ordersGateway.emitOrderUpdate(order.branchId);

    if (order.source === OrderSource.WHATSAPP) {
      this.botEventsService.emit(order.branchId, 'order.closed', {
        orderCode: order.code,
        status: order.status,
        phone: await this.customers.phoneOf(order.customerId),
      });
    }

    return order;
  }

  /** Los pedidos solo se abren si la sucursal tiene ese tipo activo. Sin mesa. */
  private async assertOrderingType(
    manager: EntityManager,
    branchId: string,
    type: OrderType,
  ): Promise<null> {
    const ordering = await manager.findOne(BranchOrdering, {
      where: { branchId },
      select: { id: true, enabled: true, types: true },
    });

    if (!ordering?.enabled) {
      throw new ConflictException('Ordering is not enabled for this branch');
    }
    if (!ordering.types.includes(type)) {
      throw new BadRequestException(`This branch does not take ${type} orders`);
    }

    return null;
  }

  /** La mesa debe estar en la lista de la sucursal, si tiene una. */
  private async acceptTable(
    manager: EntityManager,
    branchId: string,
    table: string,
  ): Promise<string> {
    const { validTables } = await manager.findOneOrFail(Branch, {
      where: { id: branchId },
      select: { id: true, validTables: true },
    });
    const accepted = acceptedTable(table, validTables);

    if (!accepted) {
      throw new BadRequestException(
        `Table ${table} is not accepted in this branch`,
      );
    }

    return accepted;
  }

  /** Descuenta el monedero al pedir la cuenta. Devuelve si pidió de más. */
  private async useWallet(
    manager: EntityManager,
    order: Order,
    { walletUse, walletAmount }: BotOrderUpdate,
  ): Promise<boolean> {
    if (!order.customerId || !walletUse || walletUse === WalletUse.NONE) {
      return false;
    }

    const { features } = await manager.findOneOrFail(Branch, {
      where: { id: order.branchId },
      select: { id: true, features: true },
    });
    if (!features.wallet) return false;

    const membership = await this.customers.lockMembership(
      manager,
      order.branchId,
      order.customerId,
    );
    const balance = toCents(membership.walletBalance);
    const wanted =
      walletUse === WalletUse.ALL ? balance : toCents(walletAmount ?? 0);
    const discount = Math.min(wanted, balance, toCents(order.subtotal));

    if (discount > 0) {
      await this.customers.moveWallet(manager, membership, {
        type: WalletMovementType.USE,
        cents: -discount,
        orderId: order.id,
      });
      order.walletDiscount = fromCents(discount);
      order.total = fromCents(toCents(order.subtotal) - discount);
    }

    return wanted > balance;
  }

  /**
   * Deshace lo que el pedido movió en el monedero. Los totales del pedido no
   * cambian: siguen diciendo lo que se cobró.
   */
  private async undoWallet(
    manager: EntityManager,
    order: Order,
    payment: Payment | null,
  ): Promise<void> {
    if (!order.customerId) return;

    const used = toCents(order.walletDiscount);
    const earned = payment ? toCents(payment.cashbackEarned) : 0;
    if (used <= 0 && earned <= 0) return;

    const membership = await this.customers.lockMembership(
      manager,
      order.branchId,
      order.customerId,
    );

    if (used > 0) {
      await this.customers.moveWallet(manager, membership, {
        type: WalletMovementType.ADJUSTMENT,
        cents: used,
        orderId: order.id,
        note: 'Pedido cancelado: saldo usado',
      });
    }

    // Si ya gastó el cashback, se quita lo que quede: nunca queda en negativo.
    const clawback = Math.min(earned, toCents(membership.walletBalance));
    if (clawback > 0) {
      await this.customers.moveWallet(manager, membership, {
        type: WalletMovementType.ADJUSTMENT,
        cents: -clawback,
        orderId: order.id,
        note: 'Pedido cancelado: cashback',
      });
    }
  }

  /** Regresa al monedero saldo que ya se había descontado de la cuenta. */
  private async returnWallet(
    manager: EntityManager,
    order: Order,
    cents: number,
    note: string,
  ): Promise<void> {
    if (cents <= 0 || !order.customerId) return;

    const membership = await this.customers.lockMembership(
      manager,
      order.branchId,
      order.customerId,
    );
    await this.customers.moveWallet(manager, membership, {
      type: WalletMovementType.ADJUSTMENT,
      cents,
      orderId: order.id,
      note,
    });

    const discount = toCents(order.walletDiscount) - cents;
    order.walletDiscount = fromCents(discount);
    order.total = fromCents(toCents(order.subtotal) - discount);
  }

  /** Si la cuenta bajó de lo que se descontó, regresa la diferencia al monedero. */
  private async refreshAfterCancellation(
    manager: EntityManager,
    orderId: string,
  ): Promise<Order> {
    const order = await this.refreshTotals(manager, orderId);
    const excess = toCents(order.walletDiscount) - toCents(order.subtotal);

    if (excess <= 0) return order;

    await this.returnWallet(manager, order, excess, 'Comanda cancelada');

    return manager.save(order);
  }

  private async addRoundTo(
    manager: EntityManager,
    order: Order,
    number: number,
    items: RoundItemInput[],
  ): Promise<RoundResult> {
    if (order.status !== OrderStatus.OPEN) {
      throw new ConflictException('The account no longer accepts rounds');
    }

    const round = await this.createRound(manager, order, number, items);
    const updated = await this.refreshTotals(manager, order.id);

    return { order: updated, round, created: true };
  }

  private async replay(
    manager: EntityManager,
    order: Order,
    branchId: string,
  ): Promise<RoundResult> {
    if (order.branchId !== branchId) {
      throw new ConflictException('The code belongs to another branch');
    }

    const round = await this.findRound(manager, order.id, 1);

    return { order, round: round!, created: false };
  }

  private findRound(
    manager: EntityManager,
    orderId: string,
    number: number,
  ): Promise<OrderRound | null> {
    return manager.findOne(OrderRound, {
      where: { orderId, number },
      relations: { items: true },
    });
  }

  private async lockOrder(
    manager: EntityManager,
    where: FindOptionsWhere<Order>,
  ): Promise<Order> {
    const order = await manager.findOne(Order, {
      where,
      lock: { mode: 'pessimistic_write' },
    });

    if (!order) throw new NotFoundException('Account not found');

    return order;
  }

  /** El precio y el nombre salen del menú: nunca de lo que envía el bot. */
  private async createRound(
    manager: EntityManager,
    order: Order,
    number: number,
    items: RoundItemInput[],
  ): Promise<OrderRound> {
    const ids = [...new Set(items.map((item) => item.menuItemId))];
    const menuItems = await manager.find(MenuItem, {
      where: { id: In(ids), menu: { branchId: order.branchId } },
      relations: { product: true, category: true },
    });
    const byId = new Map(menuItems.map((item) => [item.id, item]));

    const unknown = ids.filter((id) => !byId.has(id));
    if (unknown.length > 0) {
      throw new BadRequestException(
        `Menu items not found in this branch: ${unknown.join(', ')}`,
      );
    }

    const round = await manager.save(
      manager.create(OrderRound, { orderId: order.id, number }),
    );

    round.items = await manager.save(
      items.map((item) => {
        const menuItem = byId.get(item.menuItemId)!;

        return manager.create(OrderItem, {
          orderId: order.id,
          roundId: round.id,
          menuItemId: menuItem.id,
          quantity: item.quantity,
          price: menuItem.price,
          notes: item.note,
          productName: menuItem.product.name,
          categoryName: menuItem.category.name,
        });
      }),
    );

    return round;
  }

  private async refreshTotals(
    manager: EntityManager,
    orderId: string,
  ): Promise<Order> {
    await manager.query(
      `
      UPDATE "orders"
      SET "subtotal" = totals.amount, "total" = totals.amount - "walletDiscount"
      FROM (
        SELECT COALESCE(SUM(item."price" * item."quantity"), 0) AS amount
        FROM "order_items" AS item
        JOIN "order_rounds" AS r ON r."id" = item."roundId"
        WHERE item."orderId" = $1
          AND item."deletedAt" IS NULL
          AND r."status" <> 'cancelled'
      ) AS totals
      WHERE "orders"."id" = $1
      `,
      [orderId],
    );

    return manager.findOneByOrFail(Order, { id: orderId });
  }

  private async announceRound(
    { order, round }: RoundResult,
    options: {
      phone?: string;
      locationUnverified?: boolean;
      afterPreviousBill?: boolean;
    } = {},
  ): Promise<void> {
    const phoneNumber = options.phone
      ? normalizePhone(options.phone)
      : ((await this.customers.phoneOf(order.customerId)) ?? undefined);

    await this.notificationsService.create({
      branchId: order.branchId,
      type: NotificationType.ORDER,
      message: roundMessage(order, round.items, options),
      phoneNumber,
      orderId: order.id,
      roundId: round.id,
    });

    this.ordersGateway.emitOrderUpdate(order.branchId);

    this.logger.log(
      `Round ${round.number} of account ${order.code} in branch ${order.branchId}`,
    );
  }

  private async announceStatus(order: Order): Promise<void> {
    const notification =
      order.status === OrderStatus.BILL_REQUESTED
        ? { type: NotificationType.BILL, message: billMessage(order) }
        : order.status === OrderStatus.WITH_WAITER
          ? {
              type: NotificationType.PAY_WITH_WAITER,
              message: payWithWaiterMessage(order),
            }
          : null;

    if (notification) {
      await this.notificationsService.create({
        ...notification,
        branchId: order.branchId,
        phoneNumber:
          (await this.customers.phoneOf(order.customerId)) ?? undefined,
        orderId: order.id,
      });
    }

    this.ordersGateway.emitOrderUpdate(order.branchId);
  }
}
