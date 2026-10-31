import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lo que n8n guardaba en Redis pasa a la base: clientes por restaurante, monedero
 * con historial y pagos. No mueve datos: las tablas nacen vacías y los saldos se
 * llenan con las cuentas nuevas.
 */
export class AddWalletAndPayments1793410000000 implements MigrationInterface {
  name = 'AddWalletAndPayments1793410000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "restaurant_customers_promos_enum" AS ENUM ('pending', 'accepted', 'declined')`,
    );
    await queryRunner.query(
      `CREATE TYPE "wallet_movements_type_enum" AS ENUM ('cashback', 'use', 'adjustment')`,
    );
    await queryRunner.query(
      `CREATE TYPE "payments_status_enum" AS ENUM ('approved', 'incomplete', 'unmatched')`,
    );

    await queryRunner.query(`
      CREATE TABLE "restaurant_customers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        "visits" integer NOT NULL DEFAULT 0,
        "firstVisitAt" TIMESTAMP WITH TIME ZONE,
        "lastVisitAt" TIMESTAMP WITH TIME ZONE,
        "promos" "restaurant_customers_promos_enum" NOT NULL DEFAULT 'pending',
        "promosAt" TIMESTAMP WITH TIME ZONE,
        "unsubscribedAt" TIMESTAMP WITH TIME ZONE,
        "walletBalance" numeric(10,2) NOT NULL DEFAULT 0,
        "restaurantId" uuid NOT NULL,
        "customerId" uuid NOT NULL,
        CONSTRAINT "CHK_restaurant_customers_wallet" CHECK ("walletBalance" >= 0),
        CONSTRAINT "PK_restaurant_customers" PRIMARY KEY ("id"),
        CONSTRAINT "FK_8f5147a7ecaa671a3d9ad754db5" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_c2b1c2d3c28d5a28a5e0d3ed90f" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_restaurant_customers" ON "restaurant_customers" ("restaurantId", "customerId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_restaurant_customers_customer" ON "restaurant_customers" ("customerId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "wallet_movements" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        "type" "wallet_movements_type_enum" NOT NULL,
        "amount" numeric(10,2) NOT NULL,
        "balanceAfter" numeric(10,2) NOT NULL,
        "note" character varying,
        "restaurantCustomerId" uuid NOT NULL,
        "orderId" uuid,
        CONSTRAINT "PK_wallet_movements" PRIMARY KEY ("id"),
        CONSTRAINT "FK_b1b6ae606c6204e12f6ae0a03e1" FOREIGN KEY ("restaurantCustomerId") REFERENCES "restaurant_customers"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_e714307834f6dc89b598145296c" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_wallet_movements_rc" ON "wallet_movements" ("restaurantCustomerId", "createdAt")`,
    );

    await queryRunner.query(`
      CREATE TABLE "payments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        "provider" character varying(20) NOT NULL DEFAULT 'mercado_pago',
        "providerPaymentId" character varying(40) NOT NULL,
        "status" "payments_status_enum" NOT NULL,
        "consumption" numeric(10,2) NOT NULL DEFAULT 0,
        "tip" numeric(10,2) NOT NULL DEFAULT 0,
        "amount" numeric(10,2) NOT NULL DEFAULT 0,
        "paidAmount" numeric(10,2) NOT NULL,
        "paymentType" character varying(30),
        "cashbackEarned" numeric(10,2) NOT NULL DEFAULT 0,
        "paidAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "branchId" uuid NOT NULL,
        "orderId" uuid,
        CONSTRAINT "PK_payments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_827d04dd3e917e88271d43e664b" FOREIGN KEY ("branchId") REFERENCES "branches"("id"),
        CONSTRAINT "FK_af929a5f2a400fdb6913b4967e1" FOREIGN KEY ("orderId") REFERENCES "orders"("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_payments_provider_payment" ON "payments" ("provider", "providerPaymentId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_payments_order" ON "payments" ("orderId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_payments_branch_paid" ON "payments" ("branchId", "paidAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "payments"`);
    await queryRunner.query(`DROP TABLE "wallet_movements"`);
    await queryRunner.query(`DROP TABLE "restaurant_customers"`);
    await queryRunner.query(`DROP TYPE "payments_status_enum"`);
    await queryRunner.query(`DROP TYPE "wallet_movements_type_enum"`);
    await queryRunner.query(`DROP TYPE "restaurant_customers_promos_enum"`);
  }
}
