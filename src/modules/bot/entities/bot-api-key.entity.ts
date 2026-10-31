import { Exclude } from 'class-transformer';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Branch } from '@/modules/branches/entities/branch.entity';

/**
 * Llave de servicio con la que n8n llama a /v1/bot/*. Cada una pertenece a una
 * sucursal, y solo se guarda su hash: el valor completo se muestra una vez.
 */
@Entity({ name: 'bot_api_keys' })
export class BotApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_bot_api_keys_branch')
  @Column('uuid')
  branchId: string;

  @ManyToOne(() => Branch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'branchId' })
  branch: Branch;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  /** Inicio de la llave, para reconocerla en el panel. */
  @Column({ type: 'varchar', length: 20 })
  keyPrefix: string;

  @Exclude()
  @Index('UQ_bot_api_keys_hash', { unique: true })
  @Column({ type: 'varchar', length: 64 })
  keyHash: string;

  @Column({ type: 'timestamptz', nullable: true })
  lastUsedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
