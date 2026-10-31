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
import {
  ACTIVE_ORDER_STATUSES,
  OrderSource,
  OrderStatus,
  PaymentMethod,
  RoundStatus,
} from '@/modules/orders/enums/order.enums';
import {
  billMessage,
  dailyCloseMessage,
  payWithWaiterMessage,
  roundMessage,
} from '@/modules/orders/utils/order-messages.util';

const UNIQUE_VIOLATION = '23505';

export interface RoundItemInput {
  menuItemId: string;
  quantity: number;
  note?: string;
}

export interface OpenAccountInput {
  branchId: string;
  /** Lo genera n8n; las cuentas del personal lo reciben aquí. */
  code?: string;
  source: OrderSource;
  table: string;
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

/** Código de las cuentas que abre el personal. Las de n8n empiezan con C. */
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

    let result: RoundResult;
    try {
      result = await this.dataSource.transaction(async (manager) => {
        const existing = await manager.findOne(Order, { where: { code } });
        if (existing) return this.replay(manager, existing, input.branchId);

        const order = await manager.save(
          manager.create(Order, {
            code,
            branchId: input.branchId,
            source: input.source,
            tableLabel: input.table,
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

        if (order.customerId) {
          await this.customers.registerVisit(
            manager,
            input.branchId,
            order.customerId,
            !input.afterPreviousBill,
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

    if (result.created) {
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

    if (result.created) await this.announceRound(result);

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
          if (status === OrderStatus.PAYMENT_LINK && update.tip !== undefined) {
            locked.tip = update.tip;
            await manager.save(locked);
          }
          return { order: locked, changed: false, walletCapped: false };
        }

        if (!BOT_TRANSITIONS[locked.status]?.includes(status)) {
          throw new ConflictException(
            `The account cannot go from ${locked.status} to ${status}`,
          );
        }

        locked.status = status;
        let walletCapped = false;
        if (status === OrderStatus.BILL_REQUESTED) {
          locked.billRequestedAt = new Date();
          walletCapped = await this.useWallet(manager, locked, update);
        }
        if (status === OrderStatus.WITH_WAITER) {
          locked.paymentMethod = PaymentMethod.WAITER;
          // La propina solo se conoce con el link.
          locked.tip = 0;
        }
        if (status === OrderStatus.PAYMENT_LINK) {
          locked.paymentMethod = PaymentMethod.MERCADO_PAGO;
          locked.tip = update.tip ?? 0;
        }

        return {
          order: await manager.save(locked),
          changed: true,
          walletCapped,
        };
      },
    );

    if (changed) await this.announceStatus(order);

    return {
      order,
      walletBalance: await this.customers.balanceOf(
        order.branchId,
        order.customerId,
      ),
      walletCapped,
    };
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
   * Cierre diario: n8n borra esa noche las sesiones, así que nadie pedirá esas
   * cuentas. Solo las de WhatsApp sin cuenta pedida: las que ya tienen un cobro en
   * curso y las del personal las cierra caja.
   */
  async closeDay(branchId: string): Promise<Order[]> {
    const orders = await this.dataSource.transaction(async (manager) => {
      const open = await manager.find(Order, {
        where: {
          branchId,
          status: OrderStatus.OPEN,
          source: OrderSource.WHATSAPP,
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
