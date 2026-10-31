import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/common/database/base.entity';
import { MenuItem } from '@/modules/menus/entities/menu-item.entity';
import { OrderRound } from '@/modules/orders/entities/order-round.entity';
import { Order } from '@/modules/orders/entities/order.entity';

/** Precio unitario y nombre copiados al pedir: editar el menú no cambia el historial. */
@Entity({ name: 'order_items' })
@Check('CHK_order_items_quantity', `"quantity" BETWEEN 1 AND 50`)
export class OrderItem extends BaseEntity {
  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ type: 'varchar', nullable: true })
  productName: string | null;

  @Column({ type: 'varchar', nullable: true })
  categoryName: string | null;

  @Column({ nullable: true })
  notes?: string;

  @Index('IDX_order_items_order')
  @Column()
  orderId: string;

  /** Las órdenes anteriores a las rondas no tienen ronda. */
  @Column({ type: 'uuid', nullable: true })
  roundId: string | null;

  @Column()
  menuItemId: string;

  @ManyToOne(() => Order, (order) => order.orderItems)
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @ManyToOne(() => OrderRound, (round) => round.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roundId' })
  round: OrderRound | null;

  @ManyToOne(() => MenuItem)
  @JoinColumn({ name: 'menuItemId' })
  menuItem: MenuItem;
}
