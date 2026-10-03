import { MigrationInterface, QueryRunner } from 'typeorm';

export class TemplateEntity1771557255498 implements MigrationInterface {
  name = 'TemplateEntity1771557255498';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "templates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "key" character varying NOT NULL, "name" character varying NOT NULL, "description" text NOT NULL, "content" json NOT NULL, "variables" json, "metadata" json, "category" character varying, CONSTRAINT "UQ_526cbcc4e041988e65aec63bfb2" UNIQUE ("key"), CONSTRAINT "PK_515948649ce0bbbe391de702ae5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_526cbcc4e041988e65aec63bfb" ON "templates" ("key") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_526cbcc4e041988e65aec63bfb"`,
    );
    await queryRunner.query(`DROP TABLE "templates"`);
  }
}
