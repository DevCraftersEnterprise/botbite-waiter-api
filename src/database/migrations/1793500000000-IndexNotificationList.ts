import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * La lista de Notificaciones filtra por `isActive`, pero el único índice era
 * parcial sobre `"readAt" IS NULL`, que Postgres no puede usar para esa
 * consulta: cada carga recorría la tabla completa (issue #51). El índice
 * nuevo sirve a las sin leer y a las leídas; el viejo ya no lo usa nadie.
 */
export class IndexNotificationList1793500000000 implements MigrationInterface {
  name = 'IndexNotificationList1793500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_cashier_notifications_branch_active" ON "cashier_notifications" ("branchId", "isActive", "createdAt")`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_cashier_notifications_branch_unread"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_cashier_notifications_branch_unread" ON "cashier_notifications" ("branchId", "createdAt") WHERE "readAt" IS NULL`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_cashier_notifications_branch_active"`,
    );
  }
}
