import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixTimestampColumns1762551273239 implements MigrationInterface {
  name = 'FixTimestampColumns1762551273239';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "createdAt"`);
    await queryRunner.query(
      `ALTER TABLE "products" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "updatedAt"`);
    await queryRunner.query(
      `ALTER TABLE "products" ADD "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "menu_items" DROP COLUMN "createdAt"`);
    await queryRunner.query(
      `ALTER TABLE "menu_items" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "menu_items" DROP COLUMN "updatedAt"`);
    await queryRunner.query(
      `ALTER TABLE "menu_items" ADD "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "menus" DROP COLUMN "createdAt"`);
    await queryRunner.query(
      `ALTER TABLE "menus" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "menus" DROP COLUMN "updatedAt"`);
    await queryRunner.query(
      `ALTER TABLE "menus" ADD "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "branches" DROP COLUMN "createdAt"`);
    await queryRunner.query(
      `ALTER TABLE "branches" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "branches" DROP COLUMN "updatedAt"`);
    await queryRunner.query(
      `ALTER TABLE "branches" ADD "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" DROP COLUMN "createdAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" DROP COLUMN "updatedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" ADD "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "createdAt"`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "updatedAt"`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "customer" DROP COLUMN "createdAt"`);
    await queryRunner.query(
      `ALTER TABLE "customer" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "customer" DROP COLUMN "updatedAt"`);
    await queryRunner.query(
      `ALTER TABLE "customer" ADD "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" DROP COLUMN "createdAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" DROP COLUMN "updatedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "createdAt"`);
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "updatedAt"`);
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversation_messages" DROP COLUMN "createdAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversation_messages" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversation_messages" DROP COLUMN "updatedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversation_messages" ADD "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP COLUMN "createdAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP COLUMN "updatedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP COLUMN "updatedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP COLUMN "createdAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversation_messages" DROP COLUMN "updatedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversation_messages" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversation_messages" DROP COLUMN "createdAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversation_messages" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "updatedAt"`);
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "createdAt"`);
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" DROP COLUMN "updatedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" DROP COLUMN "createdAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "customer" DROP COLUMN "updatedAt"`);
    await queryRunner.query(
      `ALTER TABLE "customer" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "customer" DROP COLUMN "createdAt"`);
    await queryRunner.query(
      `ALTER TABLE "customer" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "updatedAt"`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "createdAt"`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" DROP COLUMN "updatedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" DROP COLUMN "createdAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "branches" DROP COLUMN "updatedAt"`);
    await queryRunner.query(
      `ALTER TABLE "branches" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "branches" DROP COLUMN "createdAt"`);
    await queryRunner.query(
      `ALTER TABLE "branches" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "menus" DROP COLUMN "updatedAt"`);
    await queryRunner.query(
      `ALTER TABLE "menus" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "menus" DROP COLUMN "createdAt"`);
    await queryRunner.query(
      `ALTER TABLE "menus" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "menu_items" DROP COLUMN "updatedAt"`);
    await queryRunner.query(
      `ALTER TABLE "menu_items" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "menu_items" DROP COLUMN "createdAt"`);
    await queryRunner.query(
      `ALTER TABLE "menu_items" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "updatedAt"`);
    await queryRunner.query(
      `ALTER TABLE "products" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "createdAt"`);
    await queryRunner.query(
      `ALTER TABLE "products" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
  }
}
