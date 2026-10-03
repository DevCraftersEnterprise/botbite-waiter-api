import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixConversationRelations1761958518111 implements MigrationInterface {
  name = 'FixConversationRelations1761958518111';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conversation_messages" DROP CONSTRAINT "FK_f5045a77718bdb593f309a1e258"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversation_messages" DROP COLUMN "conversationId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversation_messages" ADD "conversationId" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD CONSTRAINT "UQ_c7ec3c32470cfe61f947cd10b58" UNIQUE ("conversationId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c7ec3c32470cfe61f947cd10b5" ON "conversations" ("conversationId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "conversation_messages" ADD CONSTRAINT "FK_f5045a77718bdb593f309a1e258" FOREIGN KEY ("conversationId") REFERENCES "conversations"("conversationId") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conversation_messages" DROP CONSTRAINT "FK_f5045a77718bdb593f309a1e258"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c7ec3c32470cfe61f947cd10b5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP CONSTRAINT "UQ_c7ec3c32470cfe61f947cd10b58"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversation_messages" DROP COLUMN "conversationId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversation_messages" ADD "conversationId" uuid NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversation_messages" ADD CONSTRAINT "FK_f5045a77718bdb593f309a1e258" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
}
