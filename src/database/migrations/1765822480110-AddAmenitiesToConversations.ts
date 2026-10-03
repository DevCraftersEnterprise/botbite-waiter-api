import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAmenitiesToConversations1765822480110 implements MigrationInterface {
  name = 'AddAmenitiesToConversations1765822480110';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "conversations" ADD "amenities" json`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP COLUMN "amenities"`,
    );
  }
}
