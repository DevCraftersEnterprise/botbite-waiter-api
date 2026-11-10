import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Pedidos de recoger y domicilio en la misma tabla de cuentas. Solo agrega:
 * las cuentas que ya existen quedan como `dine_in`, sin datos de entrega.
 */
export class AddOrderTypeAndDelivery1793470000000 implements MigrationInterface {
  name = 'AddOrderTypeAndDelivery1793470000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "orders_type_enum" AS ENUM ('dine_in', 'pickup', 'delivery')`,
    );
    await queryRunner.query(
      `CREATE TYPE "orders_fulfillment_status_enum" AS ENUM ('pending', 'preparing', 'on_the_way', 'ready', 'delivered', 'cancelled')`,
    );
    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD "type" "orders_type_enum" NOT NULL DEFAULT 'dine_in',
        ADD "fulfillmentStatus" "orders_fulfillment_status_enum",
        ADD "fulfillmentUpdatedAt" TIMESTAMP WITH TIME ZONE,
        ADD "scheduledFor" TIMESTAMP WITH TIME ZONE,
        ADD "deliveryAddress" character varying(300),
        ADD "deliveryReferences" character varying(300),
        ADD "deliveryLatitude" numeric(9,6),
        ADD "deliveryLongitude" numeric(9,6),
        ADD "deliveryFee" numeric(10,2) NOT NULL DEFAULT 0,
        ADD "commissionPct" numeric(5,2),
        ADD CONSTRAINT "CHK_orders_delivery_fee"
          CHECK ("type" = 'delivery' OR "deliveryFee" = 0)
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_orders_branch_fulfillment" ON "orders" ("branchId", "fulfillmentStatus") WHERE "fulfillmentStatus" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD "deliveryFee" numeric(10,2) NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "deliveryFee"`);
    await queryRunner.query(`DROP INDEX "IDX_orders_branch_fulfillment"`);
    await queryRunner.query(`
      ALTER TABLE "orders"
        DROP CONSTRAINT "CHK_orders_delivery_fee",
        DROP COLUMN "commissionPct",
        DROP COLUMN "deliveryFee",
        DROP COLUMN "deliveryLongitude",
        DROP COLUMN "deliveryLatitude",
        DROP COLUMN "deliveryReferences",
        DROP COLUMN "deliveryAddress",
        DROP COLUMN "scheduledFor",
        DROP COLUMN "fulfillmentUpdatedAt",
        DROP COLUMN "fulfillmentStatus",
        DROP COLUMN "type"
    `);
    await queryRunner.query(`DROP TYPE "orders_fulfillment_status_enum"`);
    await queryRunner.query(`DROP TYPE "orders_type_enum"`);
  }
}
