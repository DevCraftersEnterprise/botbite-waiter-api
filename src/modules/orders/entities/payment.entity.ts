import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/common/database/base.entity';
import { Branch } from '@/modules/branches/entities/branch.entity';
import { Order } from '@/modules/orders/entities/order.entity';
import { PaymentStatus } from '@/modules/orders/enums/order.enums';

/**
 * Pago aprobado por el proveedor. Se guarda aunque no cuadre con una cuenta: el
 * dinero ya entró y caja debe poder revisarlo. El índice único evita procesar
 * dos veces el mismo aviso.
 */
@Entity({ name: 'payments' })
@Index('UQ_payments_provider_payment', ['provider', 'providerPaymentId'], {
  unique: true,
})
@Index('IDX_payments_order', ['orderId'])
@Index('IDX_payments_branch_paid', ['branchId', 'paidAt'])
export class Payment extends BaseEntity {
  @Column({ type: 'varchar', length: 20, default: 'mercado_pago' })
  provider: string;

  @Column({ type: 'varchar', length: 40 })
  providerPaymentId: string;

  @Column({ type: 'enum', enum: PaymentStatus })
  status: PaymentStatus;

  /** Lo que se factura y sobre lo que se calcula el cashback. */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  consumption: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  tip: number;

  /** Lo que debía la cuenta: consumo más propina. */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  amount: number;

  /** Lo que reportó el proveedor. */
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  paidAmount: number;

  @Column({ type: 'varchar', length: 30, nullable: true })
  paymentType: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  cashbackEarned: number;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  paidAt: Date;

  @Column({ type: 'uuid' })
  branchId: string;

  /** Vacío si no se encontró la cuenta del pago. */
  @Column({ type: 'uuid', nullable: true })
  orderId: string | null;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'branchId' })
  branch: Branch;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'orderId' })
  order: Order | null;
}
