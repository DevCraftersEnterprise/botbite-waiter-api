import { MigrationInterface, QueryRunner } from 'typeorm';

/** Convierte una columna de texto en slug: minúsculas, sin acentos y con guiones. */
const slugSql = (column: string) =>
  `left(trim(both '-' from regexp_replace(lower(translate(${column}, 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')), '[^a-z0-9]+', '-', 'g')), 56)`;

/** Llena `slug` en las filas existentes; si dos filas coinciden, agrega -2, -3... */
const backfillSlug = (table: string, fallback: string) => `
  WITH base AS (
    SELECT id, "createdAt", COALESCE(NULLIF(${slugSql('name')}, ''), '${fallback}') AS slug
    FROM "${table}"
  ), numbered AS (
    SELECT id, slug, row_number() OVER (PARTITION BY slug ORDER BY "createdAt", id) AS position
    FROM base
  )
  UPDATE "${table}" AS target
  SET "slug" = CASE WHEN numbered.position = 1 THEN numbered.slug ELSE numbered.slug || '-' || numbered.position END
  FROM numbered
  WHERE numbered.id = target.id`;

/**
 * Configuración del mesero de n8n: lo que hoy está en su nodo Config pasa a
 * restaurantes y sucursales, y se agregan las llaves de servicio del bot.
 */
export class AddBotConfig1793390000000 implements MigrationInterface {
  name = 'AddBotConfig1793390000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "restaurants" ADD "slug" character varying(60), ADD "walletPct" numeric(5,2) NOT NULL DEFAULT 5`,
    );
    await queryRunner.query(backfillSlug('restaurants', 'restaurante'));
    await queryRunner.query(
      `ALTER TABLE "restaurants" ALTER COLUMN "slug" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_restaurants_slug" ON "restaurants" ("slug")`,
    );

    // verifyLocation inicia apagado: las sucursales existentes no tienen
    // coordenadas y CHK_branches_location exige que las tengan para activarlo.
    await queryRunner.query(`
      ALTER TABLE "branches"
        ADD "slug" character varying(60),
        ADD "whatsappPhoneNumberId" character varying(30),
        ADD "botBaseUrl" character varying,
        ADD "latitude" numeric(9,6),
        ADD "longitude" numeric(9,6),
        ADD "verifyLocation" boolean NOT NULL DEFAULT false,
        ADD "geofenceMeters" integer NOT NULL DEFAULT 200,
        ADD "qrCodeMinutes" integer NOT NULL DEFAULT 10,
        ADD "validTables" text[] NOT NULL DEFAULT '{}',
        ADD "sessionHours" integer NOT NULL DEFAULT 16,
        ADD "postSaleHours" integer NOT NULL DEFAULT 3,
        ADD "maxRecommendations" integer NOT NULL DEFAULT 4,
        ADD "timezone" character varying(40) NOT NULL DEFAULT 'America/Hermosillo',
        ADD "dailyCloseTime" time NOT NULL DEFAULT '23:30:00',
        ADD "features" jsonb NOT NULL DEFAULT '{"interactiveMenu": true, "pdfMenu": false, "recommendations": true, "wallet": true, "mercadoPago": true, "invoicing": true, "promotions": true, "survey": true}'::jsonb
    `);
    await queryRunner.query(backfillSlug('branches', 'sucursal'));
    await queryRunner.query(
      `ALTER TABLE "branches" ALTER COLUMN "slug" SET NOT NULL`,
    );
    // Único en toda la plataforma: es parte del path del webhook y del prefijo de Redis.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_branches_slug" ON "branches" ("slug")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_branches_whatsappPhoneNumberId" ON "branches" ("whatsappPhoneNumberId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "branches" ADD CONSTRAINT "CHK_branches_location" CHECK (NOT "verifyLocation" OR ("latitude" IS NOT NULL AND "longitude" IS NOT NULL))`,
    );

    await queryRunner.query(`
      CREATE TABLE "bot_api_keys" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "branchId" uuid NOT NULL,
        "name" character varying(100) NOT NULL,
        "keyPrefix" character varying(20) NOT NULL,
        "keyHash" character varying(64) NOT NULL,
        "lastUsedAt" TIMESTAMP WITH TIME ZONE,
        "revokedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bot_api_keys" PRIMARY KEY ("id"),
        CONSTRAINT "FK_a7c7e345afb955d92860af2a488" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_bot_api_keys_hash" ON "bot_api_keys" ("keyHash")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_api_keys_branch" ON "bot_api_keys" ("branchId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "bot_api_keys"`);
    await queryRunner.query(
      `ALTER TABLE "branches" DROP CONSTRAINT "CHK_branches_location"`,
    );
    await queryRunner.query(`DROP INDEX "UQ_branches_whatsappPhoneNumberId"`);
    await queryRunner.query(`DROP INDEX "UQ_branches_slug"`);
    await queryRunner.query(`
      ALTER TABLE "branches"
        DROP COLUMN "features",
        DROP COLUMN "dailyCloseTime",
        DROP COLUMN "timezone",
        DROP COLUMN "maxRecommendations",
        DROP COLUMN "postSaleHours",
        DROP COLUMN "sessionHours",
        DROP COLUMN "validTables",
        DROP COLUMN "qrCodeMinutes",
        DROP COLUMN "geofenceMeters",
        DROP COLUMN "verifyLocation",
        DROP COLUMN "longitude",
        DROP COLUMN "latitude",
        DROP COLUMN "botBaseUrl",
        DROP COLUMN "whatsappPhoneNumberId",
        DROP COLUMN "slug"
    `);
    await queryRunner.query(`DROP INDEX "UQ_restaurants_slug"`);
    await queryRunner.query(
      `ALTER TABLE "restaurants" DROP COLUMN "walletPct", DROP COLUMN "slug"`,
    );
  }
}
