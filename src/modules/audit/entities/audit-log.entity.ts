import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Restaurant } from '@/modules/restaurants/entities/restaurant.entity';
import { User } from '@/modules/users/entities/user.entity';

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

  /** Si se borra el usuario, el registro se queda sin autor. */
  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_audit_logs_user',
  })
  user?: User | null;

  @Column({ type: 'uuid' })
  restaurantId: string;

  @ManyToOne(() => Restaurant, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'restaurantId',
    foreignKeyConstraintName: 'FK_audit_logs_restaurant',
  })
  restaurant?: Restaurant;

  @Column({ type: 'varchar', length: 50 })
  action: AuditAction;

  /** Cuántos registros se vieron o exportaron. */
  @Column({ type: 'int', default: 1 })
  recordCount: number;

  /** El cliente del restaurante, cuando es uno solo. Es un id, no un dato personal. */
  @Column({ type: 'uuid', nullable: true })
  subjectId: string | null;
}
