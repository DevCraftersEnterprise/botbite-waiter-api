import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Borra lo que quedó del bot de Twilio: conversaciones, mensajes procesados,
 * plantillas, créditos de mensajes, el token del QR anterior y el contador de
 * interacciones. Ya nada lo lee ni lo escribe.
 *
 * `down()` vuelve a crear la estructura vacía: las conversaciones y las
 * plantillas no se recuperan. Para conservarlas, respalda la base antes.
 */
export class RemoveTwilioLeftovers1793430000000 implements MigrationInterface {
  name = 'RemoveTwilioLeftovers1793430000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "conversation_messages"`);
    await queryRunner.query(`DROP TYPE "conversation_messages_role_enum"`);
    await queryRunner.query(`DROP TABLE "conversations"`);
    await queryRunner.query(`DROP TABLE "processed_messages"`);
    await queryRunner.query(`DROP TABLE "templates"`);
    await queryRunner.query(
      `ALTER TABLE "branches" DROP COLUMN "availableMessages", DROP COLUMN "qrToken"`,
    );
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "interactions"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "interactions" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "branches" ADD "availableMessages" integer NOT NULL DEFAULT 0, ADD "qrToken" character varying`,
    );
    await queryRunner.query(`
      CREATE TABLE "templates" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "key" character varying NOT NULL,
        "name" character varying NOT NULL,
        "description" text NOT NULL,
        "content" json NOT NULL,
        "variables" json,
        "metadata" json,
        "category" character varying,
        CONSTRAINT "UQ_526cbcc4e041988e65aec63bfb2" UNIQUE ("key"),
        CONSTRAINT "PK_515948649ce0bbbe391de702ae5" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_526cbcc4e041988e65aec63bfb" ON "templates" ("key")`,
    );
    await queryRunner.query(`
      CREATE TABLE "processed_messages" (
        "messageSid" character varying(64) NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_2a738cbb4fc99cef62fc994936a" PRIMARY KEY ("messageSid")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_941504721e15b8a2f2b60b2e5c" ON "processed_messages" ("createdAt")`,
    );
    await queryRunner.query(`
      CREATE TABLE "conversations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "isActive" boolean NOT NULL DEFAULT true,
        "conversationId" character varying NOT NULL,
        "phoneNumber" character varying,
        "lastActivity" TIMESTAMP NOT NULL DEFAULT now(),
        "lastOrderSentToCashier" json,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "isQrValidated" boolean NOT NULL DEFAULT false,
        "amenities" json,
        "version" integer NOT NULL,
        "branchId" uuid,
        "location" character varying,
        "lastOrderSentAt" TIMESTAMP,
        "preferredLanguage" character varying(10),
        "pendingOrder" json,
        "awaitingPaymentMethod" boolean NOT NULL DEFAULT false,
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "UQ_c7ec3c32470cfe61f947cd10b58" UNIQUE ("conversationId"),
        CONSTRAINT "PK_ee34f4f7ced4ec8681f26bf04ef" PRIMARY KEY ("id"),
        CONSTRAINT "FK_36a177d087ea05c7eb5cf618da2" FOREIGN KEY ("branchId") REFERENCES "branches"("id"),
        CONSTRAINT "FK_aaa0250d44f64aa858a2d132fd3" FOREIGN KEY ("phoneNumber") REFERENCES "customer"("phone")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_c7ec3c32470cfe61f947cd10b5" ON "conversations" ("conversationId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_conversations_phone_branch" ON "conversations" ("phoneNumber", "branchId")`,
    );
    await queryRunner.query(
      `CREATE TYPE "conversation_messages_role_enum" AS ENUM('user', 'assistant')`,
    );
    await queryRunner.query(`
      CREATE TABLE "conversation_messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "isActive" boolean NOT NULL DEFAULT true,
        "role" "conversation_messages_role_enum" NOT NULL,
        "content" text NOT NULL,
        "timestamp" TIMESTAMP NOT NULL DEFAULT now(),
        "conversationId" character varying NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_113248f25c4c0a7c179b3f5a609" PRIMARY KEY ("id"),
        CONSTRAINT "FK_f5045a77718bdb593f309a1e258" FOREIGN KEY ("conversationId") REFERENCES "conversations"("conversationId") ON DELETE CASCADE
      )
    `);
  }
}
