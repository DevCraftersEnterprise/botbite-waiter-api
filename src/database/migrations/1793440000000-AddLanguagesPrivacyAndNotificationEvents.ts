import { MigrationInterface, QueryRunner } from 'typeorm';

const FEATURES_BEFORE = `'{"interactiveMenu": true, "pdfMenu": false, "recommendations": true, "wallet": true, "mercadoPago": true, "invoicing": true, "promotions": true, "survey": true}'::jsonb`;
const FEATURES_AFTER = `'{"interactiveMenu": true, "pdfMenu": false, "recommendations": true, "wallet": true, "mercadoPago": true, "invoicing": true, "promotions": true, "survey": true, "languages": true}'::jsonb`;

/**
 * - `features.languages`: el bot pregunta el idioma. Encendido por defecto,
 *   también en las sucursales que ya existen.
 * - `restaurants.privacyUrl`: aviso de privacidad propio del restaurante.
 * - `cashier_notifications.eventId`: el bot lo repite en cada reintento para
 *   que el aviso no se duplique en caja.
 */
export class AddLanguagesPrivacyAndNotificationEvents1793440000000
  implements MigrationInterface
{
  name = 'AddLanguagesPrivacyAndNotificationEvents1793440000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "branches" ALTER COLUMN "features" SET DEFAULT ${FEATURES_AFTER}`,
    );
    await queryRunner.query(
      `UPDATE "branches" SET "features" = "features" || '{"languages": true}'::jsonb WHERE NOT ("features" ? 'languages')`,
    );

    await queryRunner.query(
      `ALTER TABLE "restaurants" ADD "privacyUrl" character varying(500)`,
    );

    await queryRunner.query(
      `ALTER TABLE "cashier_notifications" ADD "eventId" uuid`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_cashier_notifications_branch_event" ON "cashier_notifications" ("branchId", "eventId") WHERE "eventId" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "UQ_cashier_notifications_branch_event"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cashier_notifications" DROP COLUMN "eventId"`,
    );

    await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN "privacyUrl"`);

    await queryRunner.query(
      `UPDATE "branches" SET "features" = "features" - 'languages'`,
    );
    await queryRunner.query(
      `ALTER TABLE "branches" ALTER COLUMN "features" SET DEFAULT ${FEATURES_BEFORE}`,
    );
  }
}
