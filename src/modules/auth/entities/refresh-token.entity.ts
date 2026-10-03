import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { User } from '@/modules/users/entities/user.entity';

/**
 * Refresh tokens emitidos. El `id` coincide con el `jti` del JWT, lo que
 * permite rotarlos (cada uso emite uno nuevo y revoca el anterior), revocarlos
 * al cerrar sesión y detectar la reutilización de un token robado.
 */
@Entity({ name: 'refresh_tokens' })
export class RefreshToken {
  @PrimaryColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  replacedById: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
