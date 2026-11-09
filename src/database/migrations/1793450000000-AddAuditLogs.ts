import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Registro de quién vio teléfonos o exportó clientes. Sin teléfonos ni
 * nombres. Si se borra el usuario, el registro se queda sin `userId`.
 */
export class AddAuditLogs1793450000000 implements MigrationInterface {
  name = 'AddAuditLogs1793450000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "userId" uuid,
        "restaurantId" uuid NOT NULL,
        "action" character varying(50) NOT NULL,
        "recordCount" integer NOT NULL DEFAULT 1,
        "subjectId" uuid,
        CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_audit_logs_user" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_audit_logs_restaurant" FOREIGN KEY ("restaurantId")
          REFERENCES "restaurants"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_restaurant_created" ON "audit_logs" ("restaurantId", "createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_audit_logs_restaurant_created"`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);
  }
}
