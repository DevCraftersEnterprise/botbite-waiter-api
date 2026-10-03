import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateMenuItemEntityAndRelations1759859695310 implements MigrationInterface {
  name = 'UpdateMenuItemEntityAndRelations1759859695310';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "menu_items" ADD "menuId" uuid NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "menu_items" ADD "productId" uuid NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "menu_items" ADD "categoryId" integer NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "menu_items" ADD "price" numeric(10,2) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "menu_items" ADD CONSTRAINT "FK_a6b42bf45dbdef19cbf05a4cacf" FOREIGN KEY ("menuId") REFERENCES "menus"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "menu_items" ADD CONSTRAINT "FK_174d1b77128356a230241516d0a" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "menu_items" ADD CONSTRAINT "FK_d56e5ccc298e8bf721f75a7eb96" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "menu_items" DROP CONSTRAINT "FK_d56e5ccc298e8bf721f75a7eb96"`,
    );
    await queryRunner.query(
      `ALTER TABLE "menu_items" DROP CONSTRAINT "FK_174d1b77128356a230241516d0a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "menu_items" DROP CONSTRAINT "FK_a6b42bf45dbdef19cbf05a4cacf"`,
    );
    await queryRunner.query(`ALTER TABLE "menu_items" DROP COLUMN "price"`);
    await queryRunner.query(
      `ALTER TABLE "menu_items" DROP COLUMN "categoryId"`,
    );
    await queryRunner.query(`ALTER TABLE "menu_items" DROP COLUMN "productId"`);
    await queryRunner.query(`ALTER TABLE "menu_items" DROP COLUMN "menuId"`);
  }
}
