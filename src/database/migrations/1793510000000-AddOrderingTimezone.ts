import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Zona horaria propia de pedidos (Carlos, 14 nov 2026). Cada sucursal que ya
 * tiene pedidos arranca con la zona de la sucursal, así que nada cambia hasta
 * que alguien la mueva.
 */
export class AddOrderingTimezone1793510000000 implements MigrationInterface {
  name = 'AddOrderingTimezone1793510000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "branch_ordering" ADD "timezone" character varying(40)`,
    );
    await queryRunner.query(`
      UPDATE "branch_ordering" o
      SET "timezone" = b."timezone"
      FROM "branches" b
      WHERE b."id" = o."branchId"
    `);
    await queryRunner.query(
      `ALTER TABLE "branch_ordering" ALTER COLUMN "timezone" SET NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "branch_ordering" DROP COLUMN "timezone"`,
    );
  }
}
