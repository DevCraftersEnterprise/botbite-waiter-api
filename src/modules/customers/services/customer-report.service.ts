import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuditService } from '@/modules/audit/audit.service';
import { AuditAction } from '@/modules/audit/entities/audit-log.entity';
import {
  CustomerSort,
  FindRestaurantCustomersDto,
} from '@/modules/customers/dto/find-restaurant-customers.dto';
import {
  CustomerPromos,
  CustomerReportRow,
  CustomerStatus,
  INACTIVE_DAYS,
  maskPhone,
  toCustomersCsv,
} from '@/modules/customers/utils/customer-report.util';

const DEFAULT_TIMEZONE = 'America/Mexico_City';
const DEFAULT_LIMIT = 20;
const MAX_EXPORT = 50_000;
const FAVORITES = 3;

/** Columna de la consulta por cada orden que permite la pantalla. */
const SORT_COLUMNS: Record<CustomerSort, string> = {
  name: 'name',
  visits: 'visits',
  firstVisitAt: 'first_visit_at',
  lastVisitAt: 'last_visit_at',
  spent: 'spent',
  avgTicket: 'avg_ticket',
  walletBalance: 'wallet_balance',
  cashbackEarned: 'cashback_earned',
  promos: 'promos_state',
  status: 'status_rank',
};

interface ReportRecord {
  id: string;
  customer_id: string;
  name: string;
  phone: string;
  visits: number;
  first_visit_at: Date | null;
  last_visit_at: Date | null;
  promos_at: Date | null;
  unsubscribed_at: Date | null;
  wallet_balance: string;
  spent: string;
  paid_orders: number;
  avg_ticket: string;
  cashback_earned: string;
  status: CustomerStatus;
  promos_state: CustomerPromos;
  total_count: string;
}

/**
 * Pantalla Clientes: visitas, consumo, monedero, promociones y favoritos de
 * los clientes de un restaurante. Las visitas y el monedero ya se guardan
 * por restaurante; el consumo sale de sus cuentas pagadas en cualquier
 * sucursal.
 */
@Injectable()
export class CustomerReportService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly audit: AuditService,
  ) {}

  get exportEnabled(): boolean {
    return this.configService.get<boolean>('customers.exportEnabled', false);
  }

  async list(restaurantId: string, query: FindRestaurantCustomersDto) {
    const limit = query.limit ?? DEFAULT_LIMIT;
    const offset = query.offset ?? 0;
    const timezone = await this.timezoneOf(restaurantId);

    const [{ rows, total }, totals] = await Promise.all([
      this.find(restaurantId, query, { limit, offset }),
      this.totals(restaurantId, timezone),
    ]);

    return {
      customers: rows.map((row) => ({ ...row, phone: maskPhone(row.phone) })),
      total,
      totals,
      exportEnabled: this.exportEnabled,
      pagination: { limit, offset },
    };
  }

  /** El teléfono completo de un cliente. Queda registrado quién lo vio. */
  async revealPhone(restaurantId: string, id: string, userId: string) {
    const [record] = await this.dataSource.query<{ phone: string }[]>(
      `SELECT c.phone
         FROM restaurant_customers rc
         JOIN customer c ON c.id = rc."customerId"
        WHERE rc.id = $1 AND rc."restaurantId" = $2 AND rc."deletedAt" IS NULL`,
      [id, restaurantId],
    );
    if (!record) throw new NotFoundException('Customer not found');

    await this.audit.record({
      userId,
      restaurantId,
      action: AuditAction.CUSTOMER_PHONE_VIEWED,
      subjectId: id,
    });

    return { phone: record.phone };
  }

  /** CSV con los filtros de la pantalla. Queda registrado quién y cuántos. */
  async export(
    restaurantId: string,
    query: FindRestaurantCustomersDto,
    userId: string,
  ) {
    if (!this.exportEnabled) {
      throw new ForbiddenException('Customer export is not enabled yet');
    }

    const timezone = await this.timezoneOf(restaurantId);
    const { rows } = await this.find(restaurantId, query, {
      limit: MAX_EXPORT,
      offset: 0,
    });

    await this.audit.record({
      userId,
      restaurantId,
      action: AuditAction.CUSTOMERS_EXPORTED,
      recordCount: rows.length,
    });

    return {
      fileName: 'clientes.csv',
      content: toCustomersCsv(rows, timezone),
    };
  }

  private async find(
    restaurantId: string,
    query: FindRestaurantCustomersDto,
    page: { limit: number; offset: number },
  ): Promise<{ rows: CustomerReportRow[]; total: number }> {
    const params: unknown[] = [restaurantId];
    const param = (value: unknown) => `$${params.push(value)}`;
    const filters: string[] = [];

    const search = query.search?.trim();
    if (search) {
      const like = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
      const digits = search.replace(/\D/g, '');
      filters.push(
        digits.length >= 3
          ? `(name ILIKE ${param(like)} OR phone LIKE ${param(`%${digits}%`)})`
          : `name ILIKE ${param(like)}`,
      );
    }
    if (query.status) filters.push(`status = ${param(query.status)}`);
    if (query.promos) filters.push(`promos_state = ${param(query.promos)}`);

    const sort = SORT_COLUMNS[query.sort ?? 'lastVisitAt'];
    const direction = (query.order ?? 'desc') === 'asc' ? 'ASC' : 'DESC';
    const limit = param(page.limit);
    const offset = param(page.offset);

    const records = await this.dataSource.query<ReportRecord[]>(
      `WITH spend AS (
         SELECT o."customerId" AS customer_id,
                SUM(o.total) AS spent,
                COUNT(*)::int AS paid_orders
           FROM orders o
           JOIN branches b ON b.id = o."branchId"
          WHERE b."restaurantId" = $1
            AND o."customerId" IS NOT NULL
            AND o.status IN ('paid', 'settled')
            AND o."deletedAt" IS NULL
          GROUP BY o."customerId"
       ),
       earned AS (
         SELECT wm."restaurantCustomerId" AS rc_id, SUM(wm.amount) AS earned
           FROM wallet_movements wm
          WHERE wm.type = 'cashback' AND wm."deletedAt" IS NULL
          GROUP BY wm."restaurantCustomerId"
       ),
       report AS (
         SELECT rc.id,
                rc."customerId" AS customer_id,
                c.name,
                c.phone,
                rc.visits,
                rc."firstVisitAt" AS first_visit_at,
                rc."lastVisitAt" AS last_visit_at,
                rc."promosAt" AS promos_at,
                rc."unsubscribedAt" AS unsubscribed_at,
                rc."walletBalance" AS wallet_balance,
                COALESCE(spend.spent, 0) AS spent,
                COALESCE(spend.paid_orders, 0) AS paid_orders,
                CASE WHEN COALESCE(spend.paid_orders, 0) > 0
                     THEN ROUND(spend.spent / spend.paid_orders, 2)
                     ELSE 0 END AS avg_ticket,
                COALESCE(earned.earned, 0) AS cashback_earned,
                CASE WHEN rc."lastVisitAt" < now() - interval '${INACTIVE_DAYS} days' THEN 'inactive'
                     WHEN rc.visits >= 3 THEN 'recurring'
                     WHEN rc.visits = 2 THEN 'occasional'
                     ELSE 'new' END AS status,
                CASE WHEN rc."lastVisitAt" < now() - interval '${INACTIVE_DAYS} days' THEN 3
                     WHEN rc.visits >= 3 THEN 2
                     WHEN rc.visits = 2 THEN 1
                     ELSE 0 END AS status_rank,
                CASE WHEN rc."unsubscribedAt" IS NOT NULL THEN 'unsubscribed'
                     ELSE rc.promos::text END AS promos_state
           FROM restaurant_customers rc
           JOIN customer c ON c.id = rc."customerId"
           LEFT JOIN spend ON spend.customer_id = rc."customerId"
           LEFT JOIN earned ON earned.rc_id = rc.id
          WHERE rc."restaurantId" = $1 AND rc."deletedAt" IS NULL
       )
       SELECT report.*, COUNT(*) OVER () AS total_count
         FROM report
        ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
        ORDER BY ${sort} ${direction} NULLS LAST, name ASC, id ASC
        LIMIT ${limit} OFFSET ${offset}`,
      params,
    );

    const favorites = await this.favorites(
      restaurantId,
      records.map((record) => record.customer_id),
    );

    return {
      total: Number(records[0]?.total_count ?? 0),
      rows: records.map((record) => ({
        id: record.id,
        name: record.name,
        phone: record.phone,
        visits: Number(record.visits),
        firstVisitAt: record.first_visit_at,
        lastVisitAt: record.last_visit_at,
        spent: Number(record.spent),
        paidOrders: Number(record.paid_orders),
        avgTicket: Number(record.avg_ticket),
        walletBalance: Number(record.wallet_balance),
        cashbackEarned: Number(record.cashback_earned),
        promos: record.promos_state,
        promosAt: record.unsubscribed_at ?? record.promos_at,
        status: record.status,
        favorites: favorites.get(record.customer_id) ?? [],
      })),
    };
  }

  /** Los 3 productos con más unidades pedidas, sin rondas ni cuentas canceladas. */
  private async favorites(restaurantId: string, customerIds: string[]) {
    const byCustomer = new Map<string, string[]>();
    if (!customerIds.length) return byCustomer;

    const records = await this.dataSource.query<
      { customer_id: string; name: string }[]
    >(
      `SELECT o."customerId" AS customer_id, oi."productName" AS name
         FROM order_items oi
         JOIN orders o ON o.id = oi."orderId"
         JOIN branches b ON b.id = o."branchId"
         LEFT JOIN order_rounds r ON r.id = oi."roundId"
        WHERE b."restaurantId" = $1
          AND o."customerId" = ANY($2::uuid[])
          AND o.status <> 'cancelled'
          AND o."deletedAt" IS NULL
          AND oi."deletedAt" IS NULL
          AND oi."productName" IS NOT NULL
          AND (r.id IS NULL OR r.status <> 'cancelled')
        GROUP BY o."customerId", oi."productName"
        ORDER BY SUM(oi.quantity) DESC, oi."productName" ASC`,
      [restaurantId, customerIds],
    );

    for (const { customer_id, name } of records) {
      const list = byCustomer.get(customer_id) ?? [];
      if (list.length < FAVORITES) byCustomer.set(customer_id, [...list, name]);
    }
    return byCustomer;
  }

  /** Clientes, nuevos del mes, recurrentes y los que aceptaron promociones. */
  private async totals(restaurantId: string, timezone: string) {
    const [record] = await this.dataSource.query<
      {
        customers: number;
        new_this_month: number;
        recurring: number;
        promos_accepted: number;
      }[]
    >(
      `SELECT COUNT(*)::int AS customers,
              COUNT(*) FILTER (
                WHERE rc."firstVisitAt" >= (date_trunc('month', now() AT TIME ZONE $2) AT TIME ZONE $2)
              )::int AS new_this_month,
              COUNT(*) FILTER (
                WHERE rc.visits >= 3
                  AND (rc."lastVisitAt" IS NULL OR rc."lastVisitAt" >= now() - interval '${INACTIVE_DAYS} days')
              )::int AS recurring,
              COUNT(*) FILTER (
                WHERE rc.promos = 'accepted' AND rc."unsubscribedAt" IS NULL
              )::int AS promos_accepted
         FROM restaurant_customers rc
        WHERE rc."restaurantId" = $1 AND rc."deletedAt" IS NULL`,
      [restaurantId, timezone],
    );

    return {
      customers: record.customers,
      newThisMonth: record.new_this_month,
      recurring: record.recurring,
      promosAccepted: record.promos_accepted,
    };
  }

  /** La zona horaria de la primera sucursal: los totales del mes se cuentan ahí. */
  private async timezoneOf(restaurantId: string): Promise<string> {
    const [branch] = await this.dataSource.query<{ timezone: string }[]>(
      `SELECT timezone FROM branches
        WHERE "restaurantId" = $1 AND "deletedAt" IS NULL
        ORDER BY "createdAt" ASC LIMIT 1`,
      [restaurantId],
    );
    return branch?.timezone ?? DEFAULT_TIMEZONE;
  }
}
