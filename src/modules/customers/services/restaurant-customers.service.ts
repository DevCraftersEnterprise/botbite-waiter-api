import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { fromCents, toCents } from '@/common/utils/money.util';
import { Branch } from '@/modules/branches/entities/branch.entity';
import { CustomerTaxProfile } from '@/modules/customers/entities/customer-tax-profile.entity';
import { Customer } from '@/modules/customers/entities/customer.entity';
import { RestaurantCustomer } from '@/modules/customers/entities/restaurant-customer.entity';
import { WalletMovement } from '@/modules/customers/entities/wallet-movement.entity';
import {
  PromosStatus,
  WalletMovementType,
} from '@/modules/customers/enums/customer.enums';
import { normalizePhone } from '@/modules/customers/utils/phone.util';

export interface TaxProfileData {
  rfc: string;
  legalName: string;
  zip: string;
  taxRegimes: string[];
  taxRegime: string;
  cfdiUse: string;
  email: string;
}

export interface TaxProfileView extends TaxProfileData {
  consentAt: Date;
}

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
  /** Tiene datos fiscales guardados en este restaurante. */
  hasTaxProfile: boolean;
  /** Solo cuando se piden: no viajan en cada consulta. */
  taxProfile?: TaxProfileView | null;
}

export interface CustomerProfileUpdate {
  phone: string;
  name?: string;
  promos?: PromosStatus;
  unsubscribed?: boolean;
  /** Pidió que se borren sus datos fiscales. */
  deleteTaxProfile?: boolean;
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
  hasTaxProfile: false,
};

const emptyProfile = (includeTaxProfile: boolean): CustomerProfile =>
  includeTaxProfile ? { ...EMPTY_PROFILE, taxProfile: null } : EMPTY_PROFILE;

const toTaxProfileView = (profile: CustomerTaxProfile): TaxProfileView => ({
  rfc: profile.rfc,
  legalName: profile.legalName,
  zip: profile.zip,
  taxRegimes: profile.taxRegimes,
  taxRegime: profile.taxRegime,
  cfdiUse: profile.cfdiUse,
  email: profile.email,
  consentAt: profile.consentAt,
});

const toProfile = (
  name: string,
  membership: RestaurantCustomer,
  taxProfile: CustomerTaxProfile | null,
  includeTaxProfile = false,
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
  hasTaxProfile: Boolean(taxProfile),
  ...(includeTaxProfile && {
    taxProfile: taxProfile && toTaxProfileView(taxProfile),
  }),
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
  async findProfile(
    branchId: string,
    phone: string,
    includeTaxProfile = false,
  ): Promise<CustomerProfile> {
    const { manager } = this.dataSource;
    const customer = await manager.findOneBy(Customer, {
      phone: normalizePhone(phone),
    });
    if (!customer) return emptyProfile(includeTaxProfile);

    const membership = await manager.findOneBy(RestaurantCustomer, {
      restaurantId: await this.restaurantOf(manager, branchId),
      customerId: customer.id,
    });
    if (!membership) return emptyProfile(includeTaxProfile);

    return toProfile(
      customer.name,
      membership,
      await this.taxProfileOf(manager, membership.id),
      includeTaxProfile,
    );
  }

  updateProfile(
    branchId: string,
    {
      phone,
      name,
      promos,
      unsubscribed,
      deleteTaxProfile,
    }: CustomerProfileUpdate,
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

      if (deleteTaxProfile) {
        // delete() quita la fila: un soft delete dejaría los datos en la base.
        await manager.delete(CustomerTaxProfile, {
          restaurantCustomerId: membership.id,
        });
      }

      const customer = await manager.findOneByOrFail(Customer, {
        id: customerId,
      });

      return toProfile(
        customer.name,
        membership,
        await this.taxProfileOf(manager, membership.id),
      );
    });
  }

  /**
   * Reemplaza los datos fiscales guardados. Solo se llama con una factura que el
   * SAT ya aceptó, dentro de la transacción que la registra.
   */
  async saveTaxProfile(
    manager: EntityManager,
    branchId: string,
    customerId: string,
    data: TaxProfileData,
  ): Promise<void> {
    const membership = await this.lockMembership(manager, branchId, customerId);
    const profile =
      (await this.taxProfileOf(manager, membership.id)) ??
      manager.create(CustomerTaxProfile, {
        restaurantCustomerId: membership.id,
      });

    Object.assign(profile, data, { consentAt: new Date() });
    await manager.save(profile);
  }

  async hasTaxProfile(
    manager: EntityManager,
    branchId: string,
    customerId: string | null,
  ): Promise<boolean> {
    if (!customerId) return false;

    const membership = await manager.findOneBy(RestaurantCustomer, {
      restaurantId: await this.restaurantOf(manager, branchId),
      customerId,
    });

    return Boolean(
      membership && (await this.taxProfileOf(manager, membership.id)),
    );
  }

  private taxProfileOf(
    manager: EntityManager,
    restaurantCustomerId: string,
  ): Promise<CustomerTaxProfile | null> {
    return manager.findOneBy(CustomerTaxProfile, { restaurantCustomerId });
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
