import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Raw, Repository } from 'typeorm';
import { TranslationService } from '@/common/services/translation.service';
import { Order } from '@/modules/orders/entities/order.entity';
import {
  ACTIVE_ORDER_STATUSES,
  OrderStatus,
} from '@/modules/orders/enums/order.enums';
import { findAllOrdersUseCase } from '@/modules/orders/use-cases/orders/find-all-orders.use-case';
import { findOneOrderUseCase } from '@/modules/orders/use-cases/orders/find-one-order.use-case';

export interface OrdersSummary {
  accounts: number;
  openAccounts: number;
  sales: number;
  tips: number;
  averageTicket: number;
  paidOnline: number;
  paidWithWaiter: number;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
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

  private statusList(): string {
    return ACTIVE_ORDER_STATUSES.map((status) => `'${status}'`).join(', ');
  }
}
