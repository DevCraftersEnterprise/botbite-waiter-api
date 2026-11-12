import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Deja la base como la describen las entidades (issue #39), para que
 * migration:generate no proponga borrar nada.
 *
 * Una sucursal tiene un solo `branch_ordering`. Eso lo cuidaba un índice
 * único (UQ_branch_ordering_branch), pero el `@OneToOne` de TypeORM espera
 * una constraint única con el nombre de su estrategia, y no deja cambiarlo.
 * Se cambia el índice por esa constraint: sigue habiendo una por sucursal.
 */
export class AlignEntitiesWithSchema1793490000000 implements MigrationInterface {
  name = 'AlignEntitiesWithSchema1793490000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_branch_ordering_branch"`);
    await queryRunner.query(
      `ALTER TABLE "branch_ordering" ADD CONSTRAINT "UQ_211ac65b39531c75d31cd81c83d" UNIQUE ("branchId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "branch_ordering" DROP CONSTRAINT "UQ_211ac65b39531c75d31cd81c83d"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_branch_ordering_branch" ON "branch_ordering" ("branchId")`,
    );
  }
}
