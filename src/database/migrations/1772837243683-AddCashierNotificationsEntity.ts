import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCashierNotificationsEntity1772837243683 implements MigrationInterface {
  name = 'AddCashierNotificationsEntity1772837243683';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "cashier_notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "message" character varying NOT NULL, "phoneNumber" character varying, "branchId" uuid, CONSTRAINT "PK_c9aad1df2e98f0ff441af2b248c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "cashier_notifications" ADD CONSTRAINT "FK_fcb3a4daf2f3f91a4e9e6ef572d" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cashier_notifications" ADD CONSTRAINT "FK_4e889cf4bfe7bc723cc17efdfea" FOREIGN KEY ("phoneNumber") REFERENCES "customer"("phone") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "cashier_notifications" DROP CONSTRAINT "FK_4e889cf4bfe7bc723cc17efdfea"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cashier_notifications" DROP CONSTRAINT "FK_fcb3a4daf2f3f91a4e9e6ef572d"`,
    );
    await queryRunner.query(`DROP TABLE "cashier_notifications"`);
  }
}
