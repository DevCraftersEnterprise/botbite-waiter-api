import {
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Branch } from '@/modules/branches/entities/branch.entity';
import { User } from '@/modules/users/entities/user.entity';

/**
 * Personal (rol USER: cajeros y meseros) asignado a una sucursal. Un mismo
 * usuario puede trabajar en varias sucursales.
 */
@Entity({ name: 'branch_staff' })
export class BranchStaff {
  @PrimaryColumn('uuid')
  branchId: string;

  @Index()
  @PrimaryColumn('uuid')
  userId: string;

  @ManyToOne(() => Branch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'branchId' })
  branch: Branch;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
