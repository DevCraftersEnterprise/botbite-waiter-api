import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@/common/database/base.entity';

@Entity()
export class Customer extends BaseEntity {
  @Column()
  name: string;

  @Column({ unique: true })
  @Index()
  phone: string;
}
