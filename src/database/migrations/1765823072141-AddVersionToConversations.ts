import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVersionToConversations1765823072141 implements MigrationInterface {
  name = 'AddVersionToConversations1765823072141';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Primero agregar la columna como nullable
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD "version" integer`,
    );
    // Inicializar todas las filas existentes con versión 1
    await queryRunner.query(
      `UPDATE "conversations" SET "version" = 1 WHERE "version" IS NULL`,
    );
    // Ahora hacer la columna NOT NULL
    await queryRunner.query(
      `ALTER TABLE "conversations" ALTER COLUMN "version" SET NOT NULL`,
    );
    // Establecer valor por defecto para nuevas filas
    await queryRunner.query(
      `ALTER TABLE "conversations" ALTER COLUMN "version" SET DEFAULT 1`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP COLUMN "version"`,
    );
  }
}
