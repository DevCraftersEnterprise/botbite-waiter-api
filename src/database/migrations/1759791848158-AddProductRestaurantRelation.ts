import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductRestaurantRelation1759791848158 implements MigrationInterface {
  name = 'AddProductRestaurantRelation1759791848158';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "products" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "name" character varying NOT NULL, "description" character varying, "restaurant" uuid NOT NULL, CONSTRAINT "PK_0806c755e0aca124e67c0cf6d7d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD CONSTRAINT "FK_a90a3222ecd6653271e9ac4e5cc" FOREIGN KEY ("restaurant") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "products" DROP CONSTRAINT "FK_a90a3222ecd6653271e9ac4e5cc"`,
    );
    await queryRunner.query(`DROP TABLE "products"`);
  }
}
