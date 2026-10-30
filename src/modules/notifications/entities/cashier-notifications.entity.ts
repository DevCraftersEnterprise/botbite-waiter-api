import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/common/database/base.entity';
import { Branch } from '@/modules/branches/entities/branch.entity';
import { Customer } from '@/modules/customers/entities/customer.entity';

@Entity({ name: 'cashier_notifications' })
export class CashierNotification extends BaseEntity {
  @Column({ type: 'varchar' })
  message: string;

  @Column({ nullable: true })
  phoneNumber?: string;

  @Column({ nullable: true })
  branchId?: string;

  @ManyToOne(() => Branch, { nullable: true })
  @JoinColumn({ name: 'branchId' })
  branch?: Branch;

  @ManyToOne(() => Customer, { nullable: true })
  @JoinColumn({ name: 'phoneNumber', referencedColumnName: 'phone' })
  customer?: Customer;
}
