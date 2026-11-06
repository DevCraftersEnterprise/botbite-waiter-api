import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Facturas timbradas y datos fiscales guardados con permiso del comensal. Antes
 * solo vivían en FacturAPI y en Redis. No mueve datos: las tablas nacen vacías.
 */
export class AddInvoices1793420000000 implements MigrationInterface {
  name = 'AddInvoices1793420000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "invoices" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        "provider" character varying(20) NOT NULL DEFAULT 'facturapi',
        "providerInvoiceId" character varying(40) NOT NULL,
        "uuid" character varying(36) NOT NULL,
        "folio" character varying(40) NOT NULL,
        "total" numeric(10,2) NOT NULL,
        "paymentForm" character varying(2) NOT NULL,
        "rfc" character varying(13) NOT NULL,
        "legalName" character varying(300) NOT NULL,
        "zip" character varying(5) NOT NULL,
        "taxRegime" character varying(3) NOT NULL,
        "cfdiUse" character varying(4) NOT NULL,
        "emailSent" boolean NOT NULL DEFAULT false,
        "issuedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "branchId" uuid NOT NULL,
        "orderId" uuid NOT NULL,
        CONSTRAINT "PK_invoices" PRIMARY KEY ("id"),
        CONSTRAINT "FK_1e60c34407bf8d83ae612cc079d" FOREIGN KEY ("branchId") REFERENCES "branches"("id"),
        CONSTRAINT "FK_a58a78a0e0031dd93a2f56f1e8e" FOREIGN KEY ("orderId") REFERENCES "orders"("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_invoices_provider_invoice" ON "invoices" ("provider", "providerInvoiceId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_invoices_order" ON "invoices" ("orderId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_invoices_branch_issued" ON "invoices" ("branchId", "issuedAt")`,
    );

    await queryRunner.query(`
      CREATE TABLE "customer_tax_profiles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        "rfc" character varying(13) NOT NULL,
        "legalName" character varying(300) NOT NULL,
        "zip" character varying(5) NOT NULL,
        "taxRegimes" text array NOT NULL DEFAULT '{}',
        "taxRegime" character varying(3) NOT NULL,
        "cfdiUse" character varying(4) NOT NULL,
        "email" character varying(255) NOT NULL,
        "consentAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "restaurantCustomerId" uuid NOT NULL,
        CONSTRAINT "PK_customer_tax_profiles" PRIMARY KEY ("id"),
        CONSTRAINT "FK_6b6a4a4e390aa950509f036ee5e" FOREIGN KEY ("restaurantCustomerId") REFERENCES "restaurant_customers"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_customer_tax_profiles" ON "customer_tax_profiles" ("restaurantCustomerId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "customer_tax_profiles"`);
    await queryRunner.query(`DROP TABLE "invoices"`);
  }
}
