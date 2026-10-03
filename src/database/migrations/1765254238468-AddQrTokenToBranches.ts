import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQrTokenToBranches1765254238468 implements MigrationInterface {
  name = 'AddQrTokenToBranches1765254238468';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "branches" ADD "qrToken" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "branches" DROP COLUMN "qrToken"`);
  }
}
