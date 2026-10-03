import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddImageUrlProperty1765475516120 implements MigrationInterface {
  name = 'AddImageUrlProperty1765475516120';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "products" ADD "imageUrl" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "imageUrl"`);
  }
}
