import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { And, In, LessThan, MoreThanOrEqual, Raw, Repository } from 'typeorm';
import { TranslationService } from '@/common/services/translation.service';
import { Invoice } from '@/modules/orders/entities/invoice.entity';
import { Order } from '@/modules/orders/entities/order.entity';
import { Payment } from '@/modules/orders/entities/payment.entity';
import {
  ACTIVE_ORDER_STATUSES,
  OrderStatus,
} from '@/modules/orders/enums/order.enums';
import { findAllOrdersUseCase } from '@/modules/orders/use-cases/orders/find-all-orders.use-case';
import { findOneOrderUseCase } from '@/modules/orders/use-cases/orders/find-one-order.use-case';
import {
  InvoiceView,
  PaymentView,
  toInvoiceView,
  toPaymentView,
} from '@/modules/orders/utils/billing-view.util';

/** Tope por día y sucursal: muy por encima de lo que cobra un restaurante. */
const BILLING_LIMIT = 500;

export interface OrdersSummary {
  accounts: number;
  openAccounts: number;
  sales: number;
  tips: number;
  averageTicket: number;
  paidOnline: number;
  paidWithWaiter: number;
}

export interface BillingDay {
  /** YYYY-MM-DD en la zona horaria de la sucursal. */
  date: string;
  payments: PaymentView[];
  invoices: InvoiceView[];
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    private readonly translationService: TranslationService,
  ) {}

  async findAllOrders(branchId: string, lang: string) {
    return findAllOrdersUseCase({
      branchId,
      lang,
      repository: this.orderRepository,
      translationService: this.translationService,
    });
  }

  async findOneOrder(id: string, lang: string) {
    return findOneOrderUseCase({
      orderId: id,
      lang,
      repository: this.orderRepository,
      logger: this.logger,
      translationService: this.translationService,
    });
  }

  /** Una cuenta pagada sigue visible mientras cocina tenga comandas por entregar. */
  findActive(branchId: string): Promise<Order[]> {
    return this.orderRepository.find({
      where: [
        { branchId, status: In(ACTIVE_ORDER_STATUSES) },
        {
          branchId,
          status: OrderStatus.PAID,
          id: Raw(
            (alias) =>
              `${alias} IN (SELECT "orderId" FROM "order_rounds" WHERE "status" IN ('new', 'preparing') AND "deletedAt" IS NULL)`,
          ),
        },
      ],
      relations: { rounds: { items: true } },
      order: { openedAt: 'ASC' },
    });
  }

  async summary(branchId: string): Promise<OrdersSummary> {
    const [row] = await this.orderRepository.query<
      {
        accounts: number;
        openAccounts: number;
        closedAccounts: number;
        sales: string;
        tips: string;
        paidOnline: number;
        paidWithWaiter: number;
      }[]
    >(
      `
      SELECT
        count(*) FILTER (WHERE o."status" <> 'cancelled')::int AS "accounts",
        count(*) FILTER (WHERE o."status" IN (${this.statusList()}))::int AS "openAccounts",
        count(*) FILTER (WHERE o."status" IN ('paid', 'settled'))::int AS "closedAccounts",
        COALESCE(sum(o."total") FILTER (WHERE o."status" IN ('paid', 'settled')), 0) AS "sales",
        COALESCE(sum(o."tip") FILTER (WHERE o."status" IN ('paid', 'settled')), 0) AS "tips",
        count(*) FILTER (WHERE o."status" IN ('paid', 'settled') AND o."paymentMethod" = 'mercado_pago')::int AS "paidOnline",
        count(*) FILTER (WHERE o."status" IN ('paid', 'settled') AND o."paymentMethod" = 'waiter')::int AS "paidWithWaiter"
      FROM "orders" AS o
      JOIN "branches" AS b ON b."id" = o."branchId"
      WHERE o."branchId" = $1
        AND o."deletedAt" IS NULL
        AND (o."openedAt" AT TIME ZONE b."timezone")::date = (now() AT TIME ZONE b."timezone")::date
      `,
      [branchId],
    );

    const sales = Number(row.sales);

    return {
      accounts: row.accounts,
      openAccounts: row.openAccounts,
      sales,
      tips: Number(row.tips),
      averageTicket:
        row.closedAccounts > 0
          ? Math.round((sales / row.closedAccounts) * 100) / 100
          : 0,
      paidOnline: row.paidOnline,
      paidWithWaiter: row.paidWithWaiter,
    };
  }

  /** Pagos en línea y facturas de un día de la sucursal; sin fecha, los de hoy. */
  async billing(branchId: string, date?: string): Promise<BillingDay> {
    // Los límites del día se calculan en la zona de la sucursal para usar el índice.
    const [day] = await this.orderRepository.query<
      { date: string; from: Date; to: Date }[]
    >(
      `
      SELECT to_char(d."day", 'YYYY-MM-DD') AS "date",
             d."day"::timestamp AT TIME ZONE b."timezone" AS "from",
             (d."day" + 1)::timestamp AT TIME ZONE b."timezone" AS "to"
      FROM "branches" AS b
      CROSS JOIN LATERAL (
        SELECT COALESCE($2::date, (now() AT TIME ZONE b."timezone")::date) AS "day"
      ) AS d
      WHERE b."id" = $1
      `,
      [branchId, date ?? null],
    );
    if (!day) throw new NotFoundException('Branch not found');

    const range = And(MoreThanOrEqual(day.from), LessThan(day.to));
    const [payments, invoices] = await Promise.all([
      this.paymentRepository.find({
        where: { branchId, paidAt: range },
        relations: { order: true },
        order: { paidAt: 'DESC' },
        take: BILLING_LIMIT,
      }),
      this.invoiceRepository.find({
        where: { branchId, issuedAt: range },
        relations: { order: true },
        order: { issuedAt: 'DESC' },
        take: BILLING_LIMIT,
      }),
    ]);

    return {
      date: day.date,
      payments: payments.map(toPaymentView),
      invoices: invoices.map(toInvoiceView),
    };
  }

  private statusList(): string {
    return ACTIVE_ORDER_STATUSES.map((status) => `'${status}'`).join(', ');
  }
}
