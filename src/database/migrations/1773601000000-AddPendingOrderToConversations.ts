import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPendingOrderToConversations1773601000000 implements MigrationInterface {
  name = 'AddPendingOrderToConversations1773601000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD "pendingOrder" json`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD "awaitingPaymentMethod" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP COLUMN IF EXISTS "awaitingPaymentMethod"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP COLUMN IF EXISTS "pendingOrder"`,
    );
  }
}
