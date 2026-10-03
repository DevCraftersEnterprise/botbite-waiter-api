import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserRestaurantRelation1759776039890 implements MigrationInterface {
  name = 'AddUserRestaurantRelation1759776039890';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "restaurants" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "name" character varying NOT NULL, "logoUrl" character varying, "user" uuid NOT NULL, CONSTRAINT "PK_e2133a72eb1cc8f588f7b503e68" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" ADD CONSTRAINT "FK_9a0857a84b5da907dd47335494a" FOREIGN KEY ("user") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "restaurants" DROP CONSTRAINT "FK_9a0857a84b5da907dd47335494a"`,
    );
    await queryRunner.query(`DROP TABLE "restaurants"`);
  }
}
