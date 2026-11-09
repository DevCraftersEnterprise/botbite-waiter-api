import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Qué se hizo con datos personales de los clientes. */
export enum AuditAction {
  /** Vio el teléfono completo de un cliente. */
  CUSTOMER_PHONE_VIEWED = 'customer.phone_viewed',
  /** Exportó la lista de clientes a CSV. */
  CUSTOMERS_EXPORTED = 'customers.exported',
}

/**
 * Quién consultó datos personales, cuándo, qué hizo, en qué restaurante y
 * cuántos registros. Nunca guarda teléfonos ni nombres. No se edita ni se
 * borra: por eso no hereda `deletedAt` ni `updatedAt`.
 */
@Entity({ name: 'audit_logs' })
@Index('IDX_audit_logs_restaurant_created', ['restaurantId', 'createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'uuid' })
  restaurantId: string;

  @Column({ type: 'varchar', length: 50 })
  action: AuditAction;

  /** Cuántos registros se vieron o exportaron. */
  @Column({ type: 'int', default: 1 })
  recordCount: number;

  /** El cliente del restaurante, cuando es uno solo. Es un id, no un dato personal. */
  @Column({ type: 'uuid', nullable: true })
  subjectId: string | null;
}
