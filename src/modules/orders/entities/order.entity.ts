import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '@/common/database/base.entity';
import { Customer } from '@/modules/customers/entities/customer.entity';
import { Branch } from '@/modules/branches/entities/branch.entity';
import { OrderItem } from '@/modules/orders/entities/order-item.entity';

@Entity({ name: 'orders' })
export class Order extends BaseEntity {
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  total: number;

  @Column()
  customerId: string;

  @Column()
  branchId: string;

  @Column({ type: 'int', default: 0 })
  interactions: number;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'branchId' })
  branch: Branch;

  @OneToMany(() => OrderItem, (orderItem) => orderItem.order)
  orderItems: OrderItem[];
}
