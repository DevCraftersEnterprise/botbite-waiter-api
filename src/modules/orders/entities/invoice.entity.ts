import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/common/database/base.entity';
import { Branch } from '@/modules/branches/entities/branch.entity';
import { Order } from '@/modules/orders/entities/order.entity';

/**
 * Factura (CFDI) que el servicio del mesero ya timbró. Guarda lo que dice el
 * CFDI; el correo del comensal no, porque no forma parte de él. El índice único
 * evita registrar dos veces la misma factura.
 */
@Entity({ name: 'invoices' })
@Index('UQ_invoices_provider_invoice', ['provider', 'providerInvoiceId'], {
  unique: true,
})
@Index('IDX_invoices_order', ['orderId'])
@Index('IDX_invoices_branch_issued', ['branchId', 'issuedAt'])
export class Invoice extends BaseEntity {
  @Column({ type: 'varchar', length: 20, default: 'facturapi' })
  provider: string;

  @Column({ type: 'varchar', length: 40 })
  providerInvoiceId: string;

  /** Folio fiscal que asignó el SAT. */
  @Column({ type: 'varchar', length: 36 })
  uuid: string;

  @Column({ type: 'varchar', length: 40 })
  folio: string;

  /** Lo facturado. La propina no se factura. */
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total: number;

  /** Clave del SAT: 01 efectivo, 04 crédito, 28 débito… */
  @Column({ type: 'varchar', length: 2 })
  paymentForm: string;

  @Column({ type: 'varchar', length: 13 })
  rfc: string;

  @Column({ type: 'varchar', length: 300 })
  legalName: string;

  @Column({ type: 'varchar', length: 5 })
  zip: string;

  @Column({ type: 'varchar', length: 3 })
  taxRegime: string;

  @Column({ type: 'varchar', length: 4 })
  cfdiUse: string;

  /** FacturAPI confirmó que la envió por correo. */
  @Column({ type: 'boolean', default: false })
  emailSent: boolean;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  issuedAt: Date;

  @Column({ type: 'uuid' })
  branchId: string;

  @Column({ type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'branchId' })
  branch: Branch;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'orderId' })
  order: Order;
}
