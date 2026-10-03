import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQrValidationToConversations1765254894895 implements MigrationInterface {
  name = 'AddQrValidationToConversations1765254894895';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD "isQrValidated" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP COLUMN "isQrValidated"`,
    );
  }
}
