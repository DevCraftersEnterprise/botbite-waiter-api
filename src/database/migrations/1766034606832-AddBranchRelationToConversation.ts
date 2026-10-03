import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBranchRelationToConversation1766034606832 implements MigrationInterface {
  name = 'AddBranchRelationToConversation1766034606832';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conversations" ALTER COLUMN "version" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP COLUMN "branchId"`,
    );
    await queryRunner.query(`ALTER TABLE "conversations" ADD "branchId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD CONSTRAINT "FK_36a177d087ea05c7eb5cf618da2" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP CONSTRAINT "FK_36a177d087ea05c7eb5cf618da2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP COLUMN "branchId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD "branchId" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" ALTER COLUMN "version" SET DEFAULT '1'`,
    );
  }
}
