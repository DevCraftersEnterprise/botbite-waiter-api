import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { fromCents, toCents } from '@/common/utils/money.util';
import { Branch } from '@/modules/branches/entities/branch.entity';
import { Customer } from '@/modules/customers/entities/customer.entity';
import { RestaurantCustomer } from '@/modules/customers/entities/restaurant-customer.entity';
import { WalletMovement } from '@/modules/customers/entities/wallet-movement.entity';
import {
  PromosStatus,
  WalletMovementType,
} from '@/modules/customers/enums/customer.enums';
import { normalizePhone } from '@/modules/customers/utils/phone.util';

export interface CustomerProfile {
  /** false: nunca ha venido a este restaurante. */
  known: boolean;
  name: string;
  visits: number;
  firstVisitAt: Date | null;
  lastVisitAt: Date | null;
  promos: PromosStatus;
  promosAt: Date | null;
  unsubscribedAt: Date | null;
  walletBalance: number;
}

export interface CustomerProfileUpdate {
  phone: string;
  name?: string;
  promos?: PromosStatus;
  unsubscribed?: boolean;
}

export interface WalletMovementInput {
  type: WalletMovementType;
  /** Positivo si gana saldo, negativo si lo usa. */
  cents: number;
  orderId: string;
  note?: string;
}

const EMPTY_PROFILE: CustomerProfile = {
  known: false,
  name: '',
  visits: 0,
  firstVisitAt: null,
  lastVisitAt: null,
  promos: PromosStatus.PENDING,
  promosAt: null,
  unsubscribedAt: null,
  walletBalance: 0,
};

const toProfile = (
  name: string,
  membership: RestaurantCustomer,
): CustomerProfile => ({
  known: true,
  name,
  visits: membership.visits,
  firstVisitAt: membership.firstVisitAt,
  lastVisitAt: membership.lastVisitAt,
  promos: membership.promos,
  promosAt: membership.promosAt,
  unsubscribedAt: membership.unsubscribedAt,
  walletBalance: Number(membership.walletBalance),
});

/**
 * El comensal frente a un restaurante: visitas, promociones y monedero. El saldo
 * solo cambia con la fila bloqueada, porque dos sucursales pueden usarlo a la vez.
 */
@Injectable()
export class RestaurantCustomersService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Conserva el nombre guardado si WhatsApp no manda uno. */
  async upsertCustomer(
    manager: EntityManager,
    phone: string,
    name?: string,
  ): Promise<string> {
    const [{ id }] = await manager.query<{ id: string }[]>(
      `
      INSERT INTO "customer" ("phone", "name")
      VALUES ($1, $2)
      ON CONFLICT ("phone") DO UPDATE
      SET "name" = CASE WHEN EXCLUDED."name" <> '' THEN EXCLUDED."name" ELSE "customer"."name" END
      RETURNING "id"
      `,
      [normalizePhone(phone), name ?? ''],
    );

    return id;
  }

  /** Cada cuenta nueva es una visita, salvo la que sigue a otra en la misma mesa. */
  async registerVisit(
    manager: EntityManager,
    branchId: string,
    customerId: string,
    countsAsVisit: boolean,
  ): Promise<void> {
    await manager.query(
      `
      INSERT INTO "restaurant_customers" ("restaurantId", "customerId", "visits", "firstVisitAt", "lastVisitAt")
      SELECT "restaurantId", $2, $3::int, now(), now() FROM "branches" WHERE "id" = $1
      ON CONFLICT ("restaurantId", "customerId") DO UPDATE
      SET "visits" = "restaurant_customers"."visits" + EXCLUDED."visits",
          "firstVisitAt" = COALESCE("restaurant_customers"."firstVisitAt", now()),
          "lastVisitAt" = now(),
          "updatedAt" = now()
      `,
      [branchId, customerId, countsAsVisit ? 1 : 0],
    );
  }

  /** Bloquea el monedero del comensal. Si no existe, lo crea en cero. */
  async lockMembership(
    manager: EntityManager,
    branchId: string,
    customerId: string,
  ): Promise<RestaurantCustomer> {
    const restaurantId = await this.restaurantOf(manager, branchId);

    await manager
      .createQueryBuilder()
      .insert()
      .into(RestaurantCustomer)
      .values({ restaurantId, customerId })
      .orIgnore()
      .execute();

    return manager.findOneOrFail(RestaurantCustomer, {
      where: { restaurantId, customerId },
      lock: { mode: 'pessimistic_write' },
    });
  }

  /** Requiere el monedero bloqueado con `lockMembership`. */
  async moveWallet(
    manager: EntityManager,
    membership: RestaurantCustomer,
    { type, cents, orderId, note }: WalletMovementInput,
  ): Promise<void> {
    const balance = fromCents(toCents(membership.walletBalance) + cents);

    membership.walletBalance = balance;
    await manager.save(membership);

    await manager.save(
      manager.create(WalletMovement, {
        restaurantCustomerId: membership.id,
        orderId,
        type,
        amount: fromCents(cents),
        balanceAfter: balance,
        note: note ?? null,
      }),
    );
  }

  async balanceOf(
    branchId: string,
    customerId: string | null,
  ): Promise<number | null> {
    if (!customerId) return null;

    const { manager } = this.dataSource;
    const membership = await manager.findOneBy(RestaurantCustomer, {
      restaurantId: await this.restaurantOf(manager, branchId),
      customerId,
    });

    return Number(membership?.walletBalance ?? 0);
  }

  async phoneOf(customerId: string | null): Promise<string | null> {
    if (!customerId) return null;

    const customer = await this.dataSource.manager.findOneBy(Customer, {
      id: customerId,
    });

    return customer?.phone ?? null;
  }

  /** El nombre es de la plataforma: solo se muestra si ya vino a este restaurante. */
  async findProfile(branchId: string, phone: string): Promise<CustomerProfile> {
    const { manager } = this.dataSource;
    const customer = await manager.findOneBy(Customer, {
      phone: normalizePhone(phone),
    });
    if (!customer) return EMPTY_PROFILE;

    const membership = await manager.findOneBy(RestaurantCustomer, {
      restaurantId: await this.restaurantOf(manager, branchId),
      customerId: customer.id,
    });

    return membership ? toProfile(customer.name, membership) : EMPTY_PROFILE;
  }

  updateProfile(
    branchId: string,
    { phone, name, promos, unsubscribed }: CustomerProfileUpdate,
  ): Promise<CustomerProfile> {
    return this.dataSource.transaction(async (manager) => {
      const customerId = await this.upsertCustomer(manager, phone, name);
      const membership = await this.lockMembership(
        manager,
        branchId,
        customerId,
      );
      const now = new Date();

      if (unsubscribed) {
        membership.promos = PromosStatus.DECLINED;
        membership.promosAt = now;
        membership.unsubscribedAt = now;
      } else if (promos) {
        membership.promos = promos;
        membership.promosAt = now;
        if (promos === PromosStatus.ACCEPTED) membership.unsubscribedAt = null;
      }

      await manager.save(membership);

      const customer = await manager.findOneByOrFail(Customer, {
        id: customerId,
      });

      return toProfile(customer.name, membership);
    });
  }

  private async restaurantOf(
    manager: EntityManager,
    branchId: string,
  ): Promise<string> {
    const { restaurantId } = await manager.findOneOrFail(Branch, {
      where: { id: branchId },
      select: { id: true, restaurantId: true },
    });

    return restaurantId;
  }
}
