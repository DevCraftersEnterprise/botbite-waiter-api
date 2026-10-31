import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@/common/database/base.entity';

@Entity()
export class Customer extends BaseEntity {
  /** WhatsApp no siempre manda el nombre. */
  @Column({ default: '' })
  name: string;

  @Column({ unique: true })
  @Index()
  phone: string;
}
