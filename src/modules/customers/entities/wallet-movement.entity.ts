import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/common/database/base.entity';
import { RestaurantCustomer } from '@/modules/customers/entities/restaurant-customer.entity';
import { WalletMovementType } from '@/modules/customers/enums/customer.enums';
import { Order } from '@/modules/orders/entities/order.entity';

/** Historial del monedero: cada cambio de saldo deja un movimiento. */
@Entity({ name: 'wallet_movements' })
@Index('IDX_wallet_movements_rc', ['restaurantCustomerId', 'createdAt'])
export class WalletMovement extends BaseEntity {
  @Column({ type: 'enum', enum: WalletMovementType })
  type: WalletMovementType;

  /** Positivo si gana saldo, negativo si lo usa. */
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  balanceAfter: number;

  @Column({ type: 'varchar', nullable: true })
  note: string | null;

  @Column({ type: 'uuid' })
  restaurantCustomerId: string;

  @Column({ type: 'uuid', nullable: true })
  orderId: string | null;

  @ManyToOne(() => RestaurantCustomer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurantCustomerId' })
  restaurantCustomer: RestaurantCustomer;

  @ManyToOne(() => Order, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'orderId' })
  order: Order | null;
}
