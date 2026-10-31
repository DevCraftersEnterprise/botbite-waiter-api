import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '@/common/database/base.entity';
import { Customer } from '@/modules/customers/entities/customer.entity';
import { Branch } from '@/modules/branches/entities/branch.entity';
import { OrderItem } from '@/modules/orders/entities/order-item.entity';
import { OrderRound } from '@/modules/orders/entities/order-round.entity';
import {
  OrderSource,
  OrderStatus,
  PaymentMethod,
} from '@/modules/orders/enums/order.enums';

/** La cuenta de una mesa. Cada confirmación del comensal es una ronda. */
@Entity({ name: 'orders' })
@Index('IDX_orders_branch_status', ['branchId', 'status'])
@Index('IDX_orders_branch_opened', ['branchId', 'openedAt'])
export class Order extends BaseEntity {
  /** Identificador de la cuenta que comparten n8n y la API. */
  @Index('UQ_orders_code', { unique: true })
  @Column({ type: 'varchar', length: 20, nullable: true })
  code: string | null;

  @Column({
    type: 'enum',
    enum: OrderSource,
    default: OrderSource.WHATSAPP,
  })
  source: OrderSource;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.OPEN,
  })
  status: OrderStatus;

  @Column({ type: 'varchar', length: 30, nullable: true })
  tableLabel: string | null;

  @Column({ type: 'varchar', nullable: true })
  customerName: string | null;

  @Column({ type: 'varchar', length: 10, default: 'es' })
  language: string;

  @Column({ type: 'boolean', default: false })
  locationVerified: boolean;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  openedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  billRequestedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  closedAt: Date | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  walletDiscount: number;

  /** Subtotal menos monedero. La propina va aparte y no se factura. */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  total: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  tip: number;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
    enumName: 'orders_payment_method_enum',
    nullable: true,
  })
  paymentMethod: PaymentMethod | null;

  /** Las cuentas que abre el personal pueden no tener cliente. */
  @Column({ type: 'uuid', nullable: true })
  customerId: string | null;

  @Column()
  branchId: string;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customerId' })
  customer: Customer | null;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'branchId' })
  branch: Branch;

  @OneToMany(() => OrderRound, (round) => round.order)
  rounds: OrderRound[];

  @OneToMany(() => OrderItem, (orderItem) => orderItem.order)
  orderItems: OrderItem[];
}
