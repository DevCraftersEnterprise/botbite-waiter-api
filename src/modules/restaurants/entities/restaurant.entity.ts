import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '@/common/database/base.entity';
import { User } from '@/modules/users/entities/user.entity';
import { Product } from '@/modules/products/entities/product.entity';
import { Branch } from '@/modules/branches/entities/branch.entity';

@Entity({ name: 'restaurants' })
export class Restaurant extends BaseEntity {
  @Column()
  name: string;

  /** Identificador legible que usa n8n; el monedero se comparte por restaurante. */
  @Index('UQ_restaurants_slug', { unique: true })
  @Column({ type: 'varchar', length: 60 })
  slug: string;

  @Column({ nullable: true })
  logoUrl: string;

  /** Porcentaje de cashback del monedero. */
  @Column({ type: 'numeric', precision: 5, scale: 2, default: 5 })
  walletPct: number;

  @Column()
  userId: string;

  @ManyToOne(() => User, (user) => user.restaurants, {
    onDelete: 'CASCADE',
    eager: false,
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToMany(() => Product, (product) => product.restaurant)
  products: Product[];

  @OneToMany(() => Branch, (branch) => branch.restaurant)
  branches: Branch[];
}
