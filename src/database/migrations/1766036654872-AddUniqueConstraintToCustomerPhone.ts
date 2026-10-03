import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUniqueConstraintToCustomerPhone1766036654872 implements MigrationInterface {
  name = 'AddUniqueConstraintToCustomerPhone1766036654872';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "customer" ADD CONSTRAINT "UQ_03846b4bae9df80f19c76005a82" UNIQUE ("phone")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_03846b4bae9df80f19c76005a8" ON "customer" ("phone") `,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD CONSTRAINT "FK_aaa0250d44f64aa858a2d132fd3" FOREIGN KEY ("phoneNumber") REFERENCES "customer"("phone") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP CONSTRAINT "FK_aaa0250d44f64aa858a2d132fd3"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_03846b4bae9df80f19c76005a8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer" DROP CONSTRAINT "UQ_03846b4bae9df80f19c76005a82"`,
    );
  }
}
