import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Comisión de BotBite y horario del mesero, en la sucursal. Solo agrega: las
 * sucursales que ya existen quedan sin comisión y sin horario (atiende siempre).
 */
export class AddBranchCommissionAndHours1793480000000
  implements MigrationInterface
{
  name = 'AddBranchCommissionAndHours1793480000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "branches"
        ADD "commissionPct" numeric(5,2) NOT NULL DEFAULT 0,
        ADD "hours" jsonb NOT NULL DEFAULT '[]',
        ADD CONSTRAINT "CHK_branches_commission"
          CHECK ("commissionPct" >= 0 AND "commissionPct" <= 100)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "branches"
        DROP CONSTRAINT "CHK_branches_commission",
        DROP COLUMN "hours",
        DROP COLUMN "commissionPct"
    `);
  }
}
