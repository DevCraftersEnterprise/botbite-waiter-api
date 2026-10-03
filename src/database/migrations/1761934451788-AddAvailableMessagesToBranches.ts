import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAvailableMessagesToBranches1761934451788 implements MigrationInterface {
  name = 'AddAvailableMessagesToBranches1761934451788';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "branches" ADD "availableMessages" integer NOT NULL DEFAULT '0'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "branches" DROP COLUMN "availableMessages"`,
    );
  }
}
