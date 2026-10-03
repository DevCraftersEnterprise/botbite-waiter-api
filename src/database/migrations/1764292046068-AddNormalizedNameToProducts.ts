import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNormalizedNameToProducts1764292046068 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Verificar si la columna ya existe
    const table = await queryRunner.getTable('products');
    const normalizedNameColumn = table?.findColumnByName('normalizedName');

    if (!normalizedNameColumn) {
      await queryRunner.query(`
                ALTER TABLE "products" 
                ADD COLUMN "normalizedName" character varying
            `);
    }

    // Actualizar los registros existentes con el normalizedName
    await queryRunner.query(`
            UPDATE "products" 
            SET "normalizedName" = LOWER(
                TRANSLATE(
                    "name",
                    'ÁÉÍÓÚáéíóúÑñÜü',
                    'AEIOUaeiouNnUu'
                )
            )
            WHERE "normalizedName" IS NULL
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "products" 
            DROP COLUMN IF EXISTS "normalizedName"
        `);
  }
}
