import { ConflictException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { errorCode } from '@/common/utils/error.util';
import { fromCents, toCents } from '@/common/utils/money.util';
import { Branch } from '@/modules/branches/entities/branch.entity';
import { WalletMovementType } from '@/modules/customers/enums/customer.enums';
import { RestaurantCustomersService } from '@/modules/customers/services/restaurant-customers.service';
import { NotificationType } from '@/modules/notifications/enums/notification-type.enum';
import { OrdersGateway } from '@/modules/notifications/gateways/orders.gateway';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { Order } from '@/modules/orders/entities/order.entity';
import { Payment } from '@/modules/orders/entities/payment.entity';
import {
  ACTIVE_ORDER_STATUSES,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '@/modules/orders/enums/order.enums';
import {
  closedAccountPaymentMessage,
  incompletePaymentMessage,
  paymentMessage,
  unmatchedPaymentMessage,
} from '@/modules/orders/utils/order-messages.util';

const UNIQUE_VIOLATION = '23505';

/** Margen por redondeos del proveedor: el mismo que usaba el bot. */
const PAYMENT_TOLERANCE_CENTS = 50;

export interface RecordPaymentInput {
  orderCode?: string;
  providerPaymentId: string;
  amount: number;
  paymentType?: string;
}

export interface PaymentResult {
  payment: Payment;
  order: Order | null;
  /** false: era un reintento y no se procesó de nuevo. */
  created: boolean;
}

@Injectable()
export class OrderPaymentsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly customers: RestaurantCustomersService,
    private readonly notificationsService: NotificationsService,
    private readonly ordersGateway: OrdersGateway,
  ) {}

  /** Registra un pago aprobado. Reenviar el mismo aviso no lo procesa dos veces. */
  async record(
    branchId: string,
    input: RecordPaymentInput,
  ): Promise<PaymentResult> {
    const process = () =>
      this.dataSource.transaction((manager) =>
        this.apply(manager, branchId, input),
      );

    let result: PaymentResult;
    try {
      result = await process();
    } catch (error) {
      if (errorCode(error) !== UNIQUE_VIOLATION) throw error;
      // Otro reintento ganó la carrera: ahora sí se encuentra el pago.
      result = await process();
    }

    if (result.created) await this.announce(result);

    return result;
  }

  private async apply(
    manager: EntityManager,
    branchId: string,
    input: RecordPaymentInput,
  ): Promise<PaymentResult> {
    const order = input.orderCode
      ? await manager.findOne(Order, {
          where: { code: input.orderCode, branchId },
          lock: { mode: 'pessimistic_write' },
        })
      : null;

    const existing = await manager.findOneBy(Payment, {
      providerPaymentId: input.providerPaymentId,
    });

    if (existing) {
      if (existing.branchId !== branchId) {
        throw new ConflictException('The payment belongs to another branch');
      }
      return { payment: existing, order, created: false };
    }

    const owedCents = order ? toCents(order.total) + toCents(order.tip) : 0;
    const status = this.resolveStatus(order, input.amount, owedCents);

    const cashbackCents =
      order && status === PaymentStatus.APPROVED
        ? await this.closeAsPaid(manager, order)
        : 0;

    const payment = await manager.save(
      manager.create(Payment, {
        branchId,
        orderId: order?.id ?? null,
        providerPaymentId: input.providerPaymentId,
        status,
        consumption: order ? Number(order.total) : 0,
        tip: order ? Number(order.tip) : 0,
        amount: fromCents(owedCents),
        paidAmount: input.amount,
        paymentType: input.paymentType ?? null,
        cashbackEarned: fromCents(cashbackCents),
      }),
    );

    return { payment, order, created: true };
  }

  private resolveStatus(
    order: Order | null,
    paid: number,
    owedCents: number,
  ): PaymentStatus {
    if (!order || !ACTIVE_ORDER_STATUSES.includes(order.status)) {
      return PaymentStatus.UNMATCHED;
    }

    return toCents(paid) + PAYMENT_TOLERANCE_CENTS < owedCents
      ? PaymentStatus.INCOMPLETE
      : PaymentStatus.APPROVED;
  }

  private async closeAsPaid(
    manager: EntityManager,
    order: Order,
  ): Promise<number> {
    order.status = OrderStatus.PAID;
    order.paymentMethod = PaymentMethod.MERCADO_PAGO;
    order.closedAt = new Date();
    await manager.save(order);

    return this.earnCashback(manager, order);
  }

  /** Sobre lo consumido, sin propina. Solo se gana pagando en línea. */
  private async earnCashback(
    manager: EntityManager,
    order: Order,
  ): Promise<number> {
    if (!order.customerId) return 0;

    const branch = await manager.findOneOrFail(Branch, {
      where: { id: order.branchId },
      relations: { restaurant: true },
    });
    if (!branch.features.wallet) return 0;

    const percent = toCents(branch.restaurant.walletPct);
    const cents = Math.round((toCents(order.total) * percent) / 10_000);
    if (cents <= 0) return 0;

    const membership = await this.customers.lockMembership(
      manager,
      order.branchId,
      order.customerId,
    );
    await this.customers.moveWallet(manager, membership, {
      type: WalletMovementType.CASHBACK,
      cents,
      orderId: order.id,
    });

    return cents;
  }

  private async announce({ payment, order }: PaymentResult): Promise<void> {
    await this.notificationsService.create({
      ...this.noticeFor(payment, order),
      branchId: payment.branchId,
      orderId: order?.id ?? null,
      phoneNumber:
        (await this.customers.phoneOf(order?.customerId ?? null)) ?? undefined,
    });

    this.ordersGateway.emitOrderUpdate(payment.branchId);
  }

  private noticeFor(
    payment: Payment,
    order: Order | null,
  ): { type: NotificationType; message: string } {
    if (!order) {
      return {
        type: NotificationType.ALERT,
        message: unmatchedPaymentMessage(payment),
      };
    }

    switch (payment.status) {
      case PaymentStatus.APPROVED:
        return {
          type: NotificationType.PAYMENT,
          message: paymentMessage(order, payment),
        };
      case PaymentStatus.INCOMPLETE:
        return {
          type: NotificationType.ALERT,
          message: incompletePaymentMessage(order, payment),
        };
      default:
        return {
          type: NotificationType.ALERT,
          message: closedAccountPaymentMessage(order, payment),
        };
    }
  }
}
