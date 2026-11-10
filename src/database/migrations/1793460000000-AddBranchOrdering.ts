import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Modo pedidos por sucursal (recoger y domicilio). Solo agrega una tabla:
 * ninguna sucursal tiene pedidos hasta que se configuren en el panel.
 */
export class AddBranchOrdering1793460000000 implements MigrationInterface {
  name = 'AddBranchOrdering1793460000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "branch_ordering" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        "branchId" uuid NOT NULL,
        "enabled" boolean NOT NULL DEFAULT false,
        "accepting" boolean NOT NULL DEFAULT true,
        "phoneNumberId" character varying(30),
        "phoneNumber" character varying(16),
        "types" text array NOT NULL DEFAULT '{pickup,delivery}',
        "deliveryBaseFee" numeric(10,2) NOT NULL DEFAULT 0,
        "deliveryIncludedKm" numeric(6,2) NOT NULL DEFAULT 0,
        "deliveryExtraPer100m" numeric(10,2) NOT NULL DEFAULT 0,
        "deliveryMaxKm" numeric(6,2),
        "noDeliveryZones" jsonb NOT NULL DEFAULT '[]',
        "hours" jsonb NOT NULL DEFAULT '[]',
        "scheduling" jsonb NOT NULL DEFAULT '{"enabled":false,"maxDays":1,"minLeadMinutes":45,"stepMinutes":30,"reminderMinutes":30,"cancelUntilMinutes":60}',
        "commissionPct" numeric(5,2) NOT NULL DEFAULT 0,
        "paymentLinkMinutes" integer NOT NULL DEFAULT 60,
        "prepMinutes" integer NOT NULL DEFAULT 20,
        CONSTRAINT "PK_branch_ordering" PRIMARY KEY ("id"),
        CONSTRAINT "FK_branch_ordering_branch" FOREIGN KEY ("branchId")
          REFERENCES "branches"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_branch_ordering_commission"
          CHECK ("commissionPct" >= 0 AND "commissionPct" <= 100)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_branch_ordering_branch" ON "branch_ordering" ("branchId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_branch_ordering_phoneNumberId" ON "branch_ordering" ("phoneNumberId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_branch_ordering_phoneNumberId"`);
    await queryRunner.query(`DROP INDEX "UQ_branch_ordering_branch"`);
    await queryRunner.query(`DROP TABLE "branch_ordering"`);
  }
}
