import { MigrationInterface, QueryRunner } from 'typeorm';

export class ModifiedManyTables1762616080105 implements MigrationInterface {
  name = 'ModifiedManyTables1762616080105';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" RENAME COLUMN "closedAt" TO "interactions"`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" DROP COLUMN "description"`,
    );
    await queryRunner.query(`ALTER TABLE "branches" DROP COLUMN "assistantId"`);
    await queryRunner.query(`ALTER TABLE "customer" DROP COLUMN "threadId"`);
    await queryRunner.query(
      `ALTER TABLE "menus" ADD "pdfLink" character varying`,
    );
    await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN "createdAt"`);
    await queryRunner.query(
      `ALTER TABLE "categories" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN "updatedAt"`);
    await queryRunner.query(
      `ALTER TABLE "categories" ADD "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "interactions"`);
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "interactions" integer NOT NULL DEFAULT '0'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "interactions"`);
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "interactions" TIMESTAMP`,
    );
    await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN "updatedAt"`);
    await queryRunner.query(
      `ALTER TABLE "categories" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN "createdAt"`);
    await queryRunner.query(
      `ALTER TABLE "categories" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "menus" DROP COLUMN "pdfLink"`);
    await queryRunner.query(
      `ALTER TABLE "customer" ADD "threadId" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "branches" ADD "assistantId" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ADD "description" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" RENAME COLUMN "interactions" TO "closedAt"`,
    );
  }
}
