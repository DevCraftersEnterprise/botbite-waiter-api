import { MigrationInterface, QueryRunner } from 'typeorm';

export class V2Hardening1791049336004 implements MigrationInterface {
  name = 'V2Hardening1791049336004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "processed_messages" ("messageSid" character varying(64) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_2a738cbb4fc99cef62fc994936a" PRIMARY KEY ("messageSid"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_941504721e15b8a2f2b60b2e5c" ON "processed_messages" ("createdAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "refresh_tokens" ("id" uuid NOT NULL, "userId" uuid NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "revokedAt" TIMESTAMP WITH TIME ZONE, "replacedById" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_610102b60fea1455310ccd299d" ON "refresh_tokens" ("userId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD "deletedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "menu_items" ADD "deletedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "menus" ADD "deletedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "branches" ADD "deletedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" ADD "deletedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "deletedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer" ADD "deletedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD "deletedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "deletedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD "deletedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversation_messages" ADD "deletedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "cashier_notifications" ADD "deletedAt" TIMESTAMP WITH TIME ZONE`,
    );
    // v1 identificaba la conversación solo por teléfono; antes del índice único
    // se conserva la conversación más reciente de cada (teléfono, sucursal).
    await queryRunner.query(`
            DELETE FROM "conversations" c
            USING "conversations" newer
            WHERE c."phoneNumber" = newer."phoneNumber"
              AND c."branchId" = newer."branchId"
              AND (c."lastActivity", c."id") < (newer."lastActivity", newer."id")
        `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_conversations_phone_branch" ON "conversations" ("phoneNumber", "branchId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_610102b60fea1455310ccd299de" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_610102b60fea1455310ccd299de"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_conversations_phone_branch"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cashier_notifications" DROP COLUMN "deletedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversation_messages" DROP COLUMN "deletedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP COLUMN "deletedAt"`,
    );
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "deletedAt"`);
    await queryRunner.query(
      `ALTER TABLE "order_items" DROP COLUMN "deletedAt"`,
    );
    await queryRunner.query(`ALTER TABLE "customer" DROP COLUMN "deletedAt"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "deletedAt"`);
    await queryRunner.query(
      `ALTER TABLE "restaurants" DROP COLUMN "deletedAt"`,
    );
    await queryRunner.query(`ALTER TABLE "branches" DROP COLUMN "deletedAt"`);
    await queryRunner.query(`ALTER TABLE "menus" DROP COLUMN "deletedAt"`);
    await queryRunner.query(`ALTER TABLE "menu_items" DROP COLUMN "deletedAt"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "deletedAt"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_610102b60fea1455310ccd299d"`,
    );
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_941504721e15b8a2f2b60b2e5c"`,
    );
    await queryRunner.query(`DROP TABLE "processed_messages"`);
  }
}
