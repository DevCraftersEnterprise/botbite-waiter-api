import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPreferredLanguageToConversations1769970137656 implements MigrationInterface {
  name = 'AddPreferredLanguageToConversations1769970137656';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "branches" DROP COLUMN IF EXISTS "assistantContext"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD "preferredLanguage" character varying(10)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP COLUMN IF EXISTS "preferredLanguage"`,
    );
    await queryRunner.query(
      `ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "assistantContext" character varying`,
    );
  }
}
