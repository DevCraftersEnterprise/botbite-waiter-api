import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '@/common/database/base.entity';
import { User } from '@/modules/users/entities/user.entity';
import { Product } from '@/modules/products/entities/product.entity';
import { Branch } from '@/modules/branches/entities/branch.entity';

@Entity({ name: 'restaurants' })
export class Restaurant extends BaseEntity {
  @Column()
  name: string;

  @Column({ nullable: true })
  logoUrl: string;

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
