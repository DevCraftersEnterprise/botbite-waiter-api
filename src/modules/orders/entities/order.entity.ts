import {
  Check,
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
  FulfillmentStatus,
  OrderSource,
  OrderStatus,
  OrderType,
  PaymentMethod,
} from '@/modules/orders/enums/order.enums';

/**
 * La cuenta de una mesa, o un pedido de recoger o domicilio (`type`). Cada
 * confirmación del comensal es una ronda.
 */
@Entity({ name: 'orders' })
@Index('IDX_orders_branch_status', ['branchId', 'status'])
@Index('IDX_orders_branch_opened', ['branchId', 'openedAt'])
@Index('IDX_orders_branch_fulfillment', ['branchId', 'fulfillmentStatus'], {
  where: '"fulfillmentStatus" IS NOT NULL',
})
@Check('CHK_orders_delivery_fee', `"type" = 'delivery' OR "deliveryFee" = 0`)
export class Order extends BaseEntity {
  /** Identificador de la cuenta que comparten el mesero y la API. */
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

  // Sin `enumName`: el tipo se llama `orders_type_enum`, que es el nombre por
  // defecto, y si se escribe, migration:generate lo recrea en cada corrida.
  @Column({
    type: 'enum',
    enum: OrderType,
    default: OrderType.DINE_IN,
  })
  type: OrderType;

  /** Solo recoger y domicilio, desde que se pagan. */
  @Column({
    type: 'enum',
    enum: FulfillmentStatus,
    enumName: 'orders_fulfillment_status_enum',
    nullable: true,
  })
  fulfillmentStatus: FulfillmentStatus | null;

  @Column({ type: 'timestamptz', nullable: true })
  fulfillmentUpdatedAt: Date | null;

  /** Pedido programado: cuándo lo quiere el cliente. */
  @Column({ type: 'timestamptz', nullable: true })
  scheduledFor: Date | null;

  /**
   * Datos de entrega. Solo viven en el pedido, nunca en el cliente, y se
   * borran 30 días después (OrderingPrivacyService).
   */
  @Column({ type: 'varchar', length: 300, nullable: true })
  deliveryAddress: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  deliveryReferences: string | null;

  @Column({ type: 'numeric', precision: 9, scale: 6, nullable: true })
  deliveryLatitude: number | null;

  @Column({ type: 'numeric', precision: 9, scale: 6, nullable: true })
  deliveryLongitude: number | null;

  /** Lo que cobró el bot; no genera cashback. */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  deliveryFee: number;

  /** Comisión de BotBite con la que el bot generó el link. */
  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  commissionPct: number | null;

  @OneToMany(() => OrderRound, (round) => round.order)
  rounds: OrderRound[];

  @OneToMany(() => OrderItem, (orderItem) => orderItem.order)
  orderItems: OrderItem[];
}
