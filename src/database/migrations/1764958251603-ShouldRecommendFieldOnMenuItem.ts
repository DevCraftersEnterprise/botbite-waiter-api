import { MigrationInterface, QueryRunner } from 'typeorm';

export class ShouldRecommendFieldOnMenuItem1764958251603 implements MigrationInterface {
  name = 'ShouldRecommendFieldOnMenuItem1764958251603';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "menu_items" ADD "shouldRecommend" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "menu_items" DROP COLUMN "shouldRecommend"`,
    );
  }
}
