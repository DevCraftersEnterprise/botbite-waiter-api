import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBranchStaff1791055651781 implements MigrationInterface {
  name = 'AddBranchStaff1791055651781';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "branch_staff" ("branchId" uuid NOT NULL, "userId" uuid NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_16a28344e49d8d5f4867435dce5" PRIMARY KEY ("branchId", "userId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a641cc2cf997b72d86e73f0fff" ON "branch_staff" ("userId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "branch_staff" ADD CONSTRAINT "FK_3c563aa16f6c0d2807f80f6eb0f" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch_staff" ADD CONSTRAINT "FK_a641cc2cf997b72d86e73f0fff8" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "branch_staff" DROP CONSTRAINT "FK_a641cc2cf997b72d86e73f0fff8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch_staff" DROP CONSTRAINT "FK_3c563aa16f6c0d2807f80f6eb0f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a641cc2cf997b72d86e73f0fff"`,
    );
    await queryRunner.query(`DROP TABLE "branch_staff"`);
  }
}
