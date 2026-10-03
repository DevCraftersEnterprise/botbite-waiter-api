import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  VersionColumn,
} from 'typeorm';
import { BaseEntity } from '@/common/database/base.entity';
import { ConversationMessage } from '@/modules/messages/entities/conversation-message.entity';
import { Branch } from '@/modules/branches/entities/branch.entity';
import { Customer } from '@/modules/customers/entities/customer.entity';

// Una conversación por cliente y sucursal (en v1 era solo por teléfono y los
// pedidos de una sucursal podían terminar en el panel de otra).
@Entity({ name: 'conversations' })
@Index('UQ_conversations_phone_branch', ['phoneNumber', 'branchId'], {
  unique: true,
})
export class Conversation extends BaseEntity {
  @Column({ unique: true })
  @Index()
  conversationId: string;

  @VersionColumn()
  version: number;

  @Column({ nullable: true })
  branchId?: string;

  @Column({ type: 'varchar', nullable: true })
  location?: string | null;

  @ManyToOne(() => Branch, { nullable: true })
  @JoinColumn({ name: 'branchId' })
  branch?: Branch;

  @Column({ nullable: true })
  phoneNumber?: string;

  @ManyToOne(() => Customer, { nullable: true })
  @JoinColumn({ name: 'phoneNumber', referencedColumnName: 'phone' })
  customer?: Customer;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  lastActivity: Date;

  @Column({ type: 'json', nullable: true })
  lastOrderSentToCashier?: Record<
    string,
    { price: number; quantity: number; menuItemId: string; notes?: string }
  > | null;

  @Column({ type: 'timestamp', nullable: true })
  lastOrderSentAt?: Date | null;

  @Column({ type: 'json', nullable: true })
  amenities?: Record<string, number> | null;

  @Column({ type: 'boolean', default: false })
  isQrValidated: boolean;

  @Column({ type: 'varchar', length: 10, nullable: true })
  preferredLanguage?: string | null;

  @Column({ type: 'json', nullable: true })
  pendingOrder?: Record<
    string,
    { price: number; quantity: number; menuItemId: string; notes?: string }
  > | null;

  @Column({ type: 'boolean', default: false })
  awaitingPaymentMethod: boolean;

  @OneToMany(() => ConversationMessage, (message) => message.conversation, {
    cascade: false, // Prevent cascade updates that could set conversationId to undefined
  })
  messages: ConversationMessage[];
}
