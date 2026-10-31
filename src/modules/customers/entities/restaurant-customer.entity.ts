import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/common/database/base.entity';
import { Customer } from '@/modules/customers/entities/customer.entity';
import { PromosStatus } from '@/modules/customers/enums/customer.enums';
import { Restaurant } from '@/modules/restaurants/entities/restaurant.entity';

/**
 * Lo que un comensal tiene con un restaurante. El monedero y las visitas se
 * comparten entre sus sucursales, pero nunca entre restaurantes.
 */
@Entity({ name: 'restaurant_customers' })
@Index('UQ_restaurant_customers', ['restaurantId', 'customerId'], {
  unique: true,
})
@Index('IDX_restaurant_customers_customer', ['customerId'])
@Check('CHK_restaurant_customers_wallet', '"walletBalance" >= 0')
export class RestaurantCustomer extends BaseEntity {
  @Column({ type: 'int', default: 0 })
  visits: number;

  @Column({ type: 'timestamptz', nullable: true })
  firstVisitAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastVisitAt: Date | null;

  @Column({
    type: 'enum',
    enum: PromosStatus,
    default: PromosStatus.PENDING,
  })
  promos: PromosStatus;

  @Column({ type: 'timestamptz', nullable: true })
  promosAt: Date | null;

  /** Escribió BAJA. */
  @Column({ type: 'timestamptz', nullable: true })
  unsubscribedAt: Date | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  walletBalance: number;

  @Column({ type: 'uuid' })
  restaurantId: string;

  @Column({ type: 'uuid' })
  customerId: string;

  @ManyToOne(() => Restaurant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurantId' })
  restaurant: Restaurant;

  @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customerId' })
  customer: Customer;
}
