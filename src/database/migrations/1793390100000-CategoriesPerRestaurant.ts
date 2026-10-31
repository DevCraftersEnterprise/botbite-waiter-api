import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Las categorías pasan a ser de cada restaurante. Antes eran globales y el
 * nombre era único en toda la plataforma.
 *
 * Cada restaurante recibe su propia copia de las categorías existentes, así
 * sigue viendo las mismas que hoy, y sus items de menú se ligan a su copia.
 */
export class CategoriesPerRestaurant1793390100000 implements MigrationInterface {
  name = 'CategoriesPerRestaurant1793390100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "categories" ADD "restaurantId" uuid, ADD "sortOrder" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" DROP CONSTRAINT "UQ_8b0be371d28245da6e4f4b61878"`,
    );

    // categoryId es NOT NULL y su llave decía ON DELETE SET NULL: se contradecían.
    await queryRunner.query(
      `ALTER TABLE "menu_items" DROP CONSTRAINT "FK_d56e5ccc298e8bf721f75a7eb96"`,
    );
    await queryRunner.query(
      `ALTER TABLE "menu_items" ADD CONSTRAINT "FK_d56e5ccc298e8bf721f75a7eb96" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT`,
    );

    await queryRunner.query(`
      INSERT INTO "categories" ("name", "isActive", "createdAt", "updatedAt", "restaurantId")
      SELECT category."name", category."isActive", category."createdAt", category."updatedAt", restaurant."id"
      FROM "categories" AS category
      CROSS JOIN "restaurants" AS restaurant
      WHERE category."restaurantId" IS NULL
    `);
    await queryRunner.query(`
      UPDATE "menu_items" AS item
      SET "categoryId" = copy."id"
      FROM "menus" AS menu, "branches" AS branch, "categories" AS original, "categories" AS copy
      WHERE menu."id" = item."menuId"
        AND branch."id" = menu."branchId"
        AND original."id" = item."categoryId"
        AND original."restaurantId" IS NULL
        AND copy."restaurantId" = branch."restaurantId"
        AND copy."name" = original."name"
    `);
    // Si algún item quedara sin mover, RESTRICT aborta la migración aquí.
    await queryRunner.query(
      `DELETE FROM "categories" WHERE "restaurantId" IS NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "categories" ALTER COLUMN "restaurantId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ADD CONSTRAINT "FK_fe8e7d37475de7eb2f8f83a6da0" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_categories_restaurant_name" ON "categories" ("restaurantId", "name")`,
    );

    // variantGroup agrupa variantes del mismo platillo (la "familia" del bot).
    await queryRunner.query(
      `ALTER TABLE "menu_items" ADD "variantGroup" character varying(100), ADD "sortOrder" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "menu_items" DROP COLUMN "sortOrder", DROP COLUMN "variantGroup"`,
    );

    await queryRunner.query(`DROP INDEX "UQ_categories_restaurant_name"`);
    await queryRunner.query(
      `ALTER TABLE "categories" DROP CONSTRAINT "FK_fe8e7d37475de7eb2f8f83a6da0"`,
    );

    // Une las copias con el mismo nombre en una sola categoría global.
    await queryRunner.query(`
      UPDATE "menu_items" AS item
      SET "categoryId" = keeper."id"
      FROM "categories" AS current,
        (SELECT "name", min("id") AS "id" FROM "categories" GROUP BY "name") AS keeper
      WHERE current."id" = item."categoryId"
        AND keeper."name" = current."name"
    `);
    await queryRunner.query(`
      DELETE FROM "categories" AS category
      WHERE category."id" NOT IN (SELECT min("id") FROM "categories" GROUP BY "name")
    `);

    await queryRunner.query(
      `ALTER TABLE "menu_items" DROP CONSTRAINT "FK_d56e5ccc298e8bf721f75a7eb96"`,
    );
    await queryRunner.query(
      `ALTER TABLE "menu_items" ADD CONSTRAINT "FK_d56e5ccc298e8bf721f75a7eb96" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "categories" ADD CONSTRAINT "UQ_8b0be371d28245da6e4f4b61878" UNIQUE ("name")`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" DROP COLUMN "sortOrder", DROP COLUMN "restaurantId"`,
    );
  }
}
