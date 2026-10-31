import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `orders` pasa a ser la cuenta de una mesa y cada comanda es una ronda:
 * la orden nace con la primera ronda confirmada y avanza de estado, en lugar de
 * crearse hasta cerrar la cuenta.
 */
export class AddOrderRounds1793400000000 implements MigrationInterface {
  name = 'AddOrderRounds1793400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "orders_status_enum" AS ENUM ('open', 'bill_requested', 'payment_link', 'with_waiter', 'paid', 'settled', 'auto_closed', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TYPE "orders_source_enum" AS ENUM ('whatsapp', 'staff')`,
    );
    await queryRunner.query(
      `CREATE TYPE "orders_payment_method_enum" AS ENUM ('mercado_pago', 'waiter')`,
    );
    await queryRunner.query(
      `CREATE TYPE "order_rounds_status_enum" AS ENUM ('new', 'preparing', 'delivered', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TYPE "cashier_notifications_type_enum" AS ENUM ('order', 'bill', 'pay_with_waiter', 'payment', 'alert', 'invoice')`,
    );

    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD "code" character varying(20),
        ADD "source" "orders_source_enum" NOT NULL DEFAULT 'whatsapp',
        ADD "status" "orders_status_enum" NOT NULL DEFAULT 'open',
        ADD "tableLabel" character varying(30),
        ADD "customerName" character varying,
        ADD "language" character varying(10) NOT NULL DEFAULT 'es',
        ADD "locationVerified" boolean NOT NULL DEFAULT false,
        ADD "openedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        ADD "billRequestedAt" TIMESTAMP WITH TIME ZONE,
        ADD "closedAt" TIMESTAMP WITH TIME ZONE,
        ADD "subtotal" numeric(10,2) NOT NULL DEFAULT 0,
        ADD "walletDiscount" numeric(10,2) NOT NULL DEFAULT 0,
        ADD "tip" numeric(10,2) NOT NULL DEFAULT 0,
        ADD "paymentMethod" "orders_payment_method_enum"
    `);
    // Las órdenes existentes se crearon al cerrar la cuenta: ya están cobradas.
    await queryRunner.query(`
      UPDATE "orders"
      SET "status" = 'settled',
          "paymentMethod" = 'waiter',
          "subtotal" = "total",
          "openedAt" = "createdAt",
          "closedAt" = "createdAt"
    `);
    await queryRunner.query(
      `ALTER TABLE "orders" ALTER COLUMN "customerId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_orders_code" ON "orders" ("code")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_orders_branch_status" ON "orders" ("branchId", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_orders_branch_opened" ON "orders" ("branchId", "openedAt")`,
    );

    await queryRunner.query(`
      CREATE TABLE "order_rounds" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        "orderId" uuid NOT NULL,
        "number" integer NOT NULL,
        "status" "order_rounds_status_enum" NOT NULL DEFAULT 'new',
        "sentAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "acknowledgedAt" TIMESTAMP WITH TIME ZONE,
        "deliveredAt" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_order_rounds" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_order_rounds_number" ON "order_rounds" ("orderId", "number")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_order_rounds_status" ON "order_rounds" ("status", "sentAt")`,
    );

    await queryRunner.query(`
      ALTER TABLE "order_items"
        ADD "roundId" uuid,
        ADD "quantity" integer NOT NULL DEFAULT 1,
        ADD "productName" character varying,
        ADD "categoryName" character varying
    `);
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD CONSTRAINT "CHK_order_items_quantity" CHECK ("quantity" BETWEEN 1 AND 50)`,
    );
    // Copia del nombre: el historial no debe cambiar si editan el menú.
    await queryRunner.query(`
      UPDATE "order_items" AS item
      SET "productName" = product."name", "categoryName" = category."name"
      FROM "menu_items" AS menu_item, "products" AS product, "categories" AS category
      WHERE menu_item."id" = item."menuItemId"
        AND product."id" = menu_item."productId"
        AND category."id" = menu_item."categoryId"
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_order_items_order" ON "order_items" ("orderId")`,
    );

    await queryRunner.query(`
      ALTER TABLE "cashier_notifications"
        ADD "type" "cashier_notifications_type_enum" NOT NULL DEFAULT 'alert',
        ADD "orderId" uuid,
        ADD "roundId" uuid,
        ADD "readAt" TIMESTAMP WITH TIME ZONE
    `);
    // Hasta ahora, "leída" se guardaba como isActive = false.
    await queryRunner.query(
      `UPDATE "cashier_notifications" SET "readAt" = "updatedAt" WHERE "isActive" = false`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cashier_notifications_branch_unread" ON "cashier_notifications" ("branchId", "createdAt") WHERE "readAt" IS NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "customer" ALTER COLUMN "name" SET DEFAULT ''`,
    );

    await queryRunner.query(
      `ALTER TABLE "order_rounds" ADD CONSTRAINT "FK_c30596363b9ce51b5b5ce6c3e7c" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD CONSTRAINT "FK_c51ad374dfa30deb34d6821cdd7" FOREIGN KEY ("roundId") REFERENCES "order_rounds"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "cashier_notifications" ADD CONSTRAINT "FK_e8a19477ae5daa4976962c2b18e" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "cashier_notifications" ADD CONSTRAINT "FK_367a5b956354f3ba7427eaf2cb0" FOREIGN KEY ("roundId") REFERENCES "order_rounds"("id") ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "cashier_notifications" DROP CONSTRAINT "FK_367a5b956354f3ba7427eaf2cb0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cashier_notifications" DROP CONSTRAINT "FK_e8a19477ae5daa4976962c2b18e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" DROP CONSTRAINT "FK_c51ad374dfa30deb34d6821cdd7"`,
    );

    await queryRunner.query(
      `ALTER TABLE "customer" ALTER COLUMN "name" DROP DEFAULT`,
    );

    await queryRunner.query(
      `DROP INDEX "IDX_cashier_notifications_branch_unread"`,
    );
    await queryRunner.query(`
      ALTER TABLE "cashier_notifications"
        DROP COLUMN "readAt",
        DROP COLUMN "roundId",
        DROP COLUMN "orderId",
        DROP COLUMN "type"
    `);

    // Antes una fila era una pieza: se recuperan las piezas de cada renglón.
    await queryRunner.query(`
      INSERT INTO "order_items" ("price", "notes", "orderId", "menuItemId")
      SELECT item."price", item."notes", item."orderId", item."menuItemId"
      FROM "order_items" AS item
      CROSS JOIN LATERAL generate_series(2, item."quantity")
    `);
    await queryRunner.query(`DROP INDEX "IDX_order_items_order"`);
    await queryRunner.query(
      `ALTER TABLE "order_items" DROP CONSTRAINT "CHK_order_items_quantity"`,
    );
    await queryRunner.query(`
      ALTER TABLE "order_items"
        DROP COLUMN "categoryName",
        DROP COLUMN "productName",
        DROP COLUMN "quantity",
        DROP COLUMN "roundId"
    `);

    await queryRunner.query(`DROP TABLE "order_rounds"`);

    // Las cuentas sin cliente no existían antes de esta migración.
    await queryRunner.query(
      `DELETE FROM "order_items" WHERE "orderId" IN (SELECT "id" FROM "orders" WHERE "customerId" IS NULL)`,
    );
    await queryRunner.query(`DELETE FROM "orders" WHERE "customerId" IS NULL`);
    await queryRunner.query(`DROP INDEX "IDX_orders_branch_opened"`);
    await queryRunner.query(`DROP INDEX "IDX_orders_branch_status"`);
    await queryRunner.query(`DROP INDEX "UQ_orders_code"`);
    await queryRunner.query(
      `ALTER TABLE "orders" ALTER COLUMN "customerId" SET NOT NULL`,
    );
    await queryRunner.query(`
      ALTER TABLE "orders"
        DROP COLUMN "paymentMethod",
        DROP COLUMN "tip",
        DROP COLUMN "walletDiscount",
        DROP COLUMN "subtotal",
        DROP COLUMN "closedAt",
        DROP COLUMN "billRequestedAt",
        DROP COLUMN "openedAt",
        DROP COLUMN "locationVerified",
        DROP COLUMN "language",
        DROP COLUMN "customerName",
        DROP COLUMN "tableLabel",
        DROP COLUMN "status",
        DROP COLUMN "source",
        DROP COLUMN "code"
    `);

    await queryRunner.query(`DROP TYPE "cashier_notifications_type_enum"`);
    await queryRunner.query(`DROP TYPE "order_rounds_status_enum"`);
    await queryRunner.query(`DROP TYPE "orders_payment_method_enum"`);
    await queryRunner.query(`DROP TYPE "orders_source_enum"`);
    await queryRunner.query(`DROP TYPE "orders_status_enum"`);
  }
}
