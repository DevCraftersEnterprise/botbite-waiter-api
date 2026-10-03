import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLastOrderSentAtToConversation1766034823741 implements MigrationInterface {
  name = 'AddLastOrderSentAtToConversation1766034823741';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD "location" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD "lastOrderSentAt" TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP COLUMN "lastOrderSentAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP COLUMN "location"`,
    );
  }
}
