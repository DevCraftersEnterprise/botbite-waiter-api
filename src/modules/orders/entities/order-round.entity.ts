import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '@/common/database/base.entity';
import { OrderItem } from '@/modules/orders/entities/order-item.entity';
import { Order } from '@/modules/orders/entities/order.entity';
import { RoundStatus } from '@/modules/orders/enums/order.enums';

/** Cada "confirmar" del comensal: una comanda para cocina y caja. */
@Entity({ name: 'order_rounds' })
@Index('UQ_order_rounds_number', ['orderId', 'number'], { unique: true })
@Index('IDX_order_rounds_status', ['status', 'sentAt'])
export class OrderRound extends BaseEntity {
  @Column('uuid')
  orderId: string;

  @Column({ type: 'int' })
  number: number;

  @Column({
    type: 'enum',
    enum: RoundStatus,
    default: RoundStatus.NEW,
  })
  status: RoundStatus;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  sentAt: Date;

  /** Cuando caja o cocina la tomó. */
  @Column({ type: 'timestamptz', nullable: true })
  acknowledgedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  deliveredAt: Date | null;

  @ManyToOne(() => Order, (order) => order.rounds, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @OneToMany(() => OrderItem, (item) => item.round)
  items: OrderItem[];
}
