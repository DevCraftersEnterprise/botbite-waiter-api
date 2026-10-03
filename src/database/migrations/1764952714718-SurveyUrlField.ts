import { MigrationInterface, QueryRunner } from 'typeorm';

export class SurveyUrlField1764952714718 implements MigrationInterface {
  name = 'SurveyUrlField1764952714718';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "branches" ADD "surveyUrl" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "branches" DROP COLUMN "surveyUrl"`);
  }
}
