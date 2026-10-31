import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/common/database/base.entity';
import { Branch } from '@/modules/branches/entities/branch.entity';
import { Customer } from '@/modules/customers/entities/customer.entity';
import { NotificationType } from '@/modules/notifications/enums/notification-type.enum';
import { OrderRound } from '@/modules/orders/entities/order-round.entity';
import { Order } from '@/modules/orders/entities/order.entity';

@Entity({ name: 'cashier_notifications' })
@Index('IDX_cashier_notifications_branch_unread', ['branchId', 'createdAt'], {
  where: '"readAt" IS NULL',
})
export class CashierNotification extends BaseEntity {
  @Column({
    type: 'enum',
    enum: NotificationType,
    default: NotificationType.ALERT,
  })
  type: NotificationType;

  @Column({ type: 'varchar' })
  message: string;

  @Column({ nullable: true })
  phoneNumber?: string;

  @Column({ nullable: true })
  branchId?: string;

  @Column({ type: 'uuid', nullable: true })
  orderId: string | null;

  @Column({ type: 'uuid', nullable: true })
  roundId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @ManyToOne(() => Branch, { nullable: true })
  @JoinColumn({ name: 'branchId' })
  branch?: Branch;

  @ManyToOne(() => Customer, { nullable: true })
  @JoinColumn({ name: 'phoneNumber', referencedColumnName: 'phone' })
  customer?: Customer;

  @ManyToOne(() => Order, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order?: Order;

  @ManyToOne(() => OrderRound, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roundId' })
  round?: OrderRound;
}
