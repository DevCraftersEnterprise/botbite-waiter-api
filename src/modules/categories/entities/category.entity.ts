import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Restaurant } from '@/modules/restaurants/entities/restaurant.entity';

@Entity({ name: 'categories' })
@Index('UQ_categories_restaurant_name', ['restaurantId', 'name'], {
  unique: true,
})
export class Category {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column('uuid')
  restaurantId: string;

  @ManyToOne(() => Restaurant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurantId' })
  restaurant: Restaurant;

  /** Orden de la sección en el menú web. */
  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ default: true, type: 'boolean' })
  isActive: boolean;

  @CreateDateColumn({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  toUpperCaseFields() {
    if (this.name) this.name = this.name.toUpperCase();
  }
}
