import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveCustomerIdFromConversations1761968477538 implements MigrationInterface {
  name = 'RemoveCustomerIdFromConversations1761968477538';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP COLUMN "customerId"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD "customerId" character varying`,
    );
  }
}
