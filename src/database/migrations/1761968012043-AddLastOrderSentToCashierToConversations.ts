import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLastOrderSentToCashierToConversations1761968012043 implements MigrationInterface {
  name = 'AddLastOrderSentToCashierToConversations1761968012043';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD "lastOrderSentToCashier" json`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP COLUMN "lastOrderSentToCashier"`,
    );
  }
}
