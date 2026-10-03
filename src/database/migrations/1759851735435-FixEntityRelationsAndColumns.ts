import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixEntityRelationsAndColumns1759851735435 implements MigrationInterface {
  name = 'FixEntityRelationsAndColumns1759851735435';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "products" DROP CONSTRAINT "FK_a90a3222ecd6653271e9ac4e5cc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" DROP CONSTRAINT "FK_9a0857a84b5da907dd47335494a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" RENAME COLUMN "restaurant" TO "restaurantId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" RENAME COLUMN "user" TO "userId"`,
    );
    await queryRunner.query(
      `CREATE TABLE "branches" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "name" character varying NOT NULL, "address" character varying NOT NULL, "phoneNumberAssistant" character varying, "phoneNumberReception" character varying, "assistantId" character varying, "qrUrl" character varying, "restaurantId" uuid NOT NULL, CONSTRAINT "PK_7f37d3b42defea97f1df0d19535" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD CONSTRAINT "FK_11a1d3b4f6f1c6630be3127391d" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "branches" ADD CONSTRAINT "FK_8e15b49e90860a336c6277cf971" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" ADD CONSTRAINT "FK_a6d82a35be7467761ee3a1a309e" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "restaurants" DROP CONSTRAINT "FK_a6d82a35be7467761ee3a1a309e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "branches" DROP CONSTRAINT "FK_8e15b49e90860a336c6277cf971"`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" DROP CONSTRAINT "FK_11a1d3b4f6f1c6630be3127391d"`,
    );
    await queryRunner.query(`DROP TABLE "branches"`);
    await queryRunner.query(
      `ALTER TABLE "restaurants" RENAME COLUMN "userId" TO "user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" RENAME COLUMN "restaurantId" TO "restaurant"`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" ADD CONSTRAINT "FK_9a0857a84b5da907dd47335494a" FOREIGN KEY ("user") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD CONSTRAINT "FK_a90a3222ecd6653271e9ac4e5cc" FOREIGN KEY ("restaurant") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
}
