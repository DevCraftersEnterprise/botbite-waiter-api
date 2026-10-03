import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/common/database/base.entity';
import { Menu } from '@/modules/menus/entities/menu.entity';
import { Product } from '@/modules/products/entities/product.entity';
import { Category } from '@/modules/categories/entities/category.entity';

@Entity({ name: 'menu_items' })
export class MenuItem extends BaseEntity {
  @Column()
  menuId: string;

  @Column()
  productId: string;

  @Column()
  categoryId: number;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Column({ default: false })
  shouldRecommend: boolean;

  @ManyToOne(() => Menu, (menu) => menu.id)
  @JoinColumn({ name: 'menuId' })
  menu: Menu;

  @ManyToOne(() => Product, (product) => product.id)
  @JoinColumn({ name: 'productId' })
  product: Product;

  @ManyToOne(() => Category, (category) => category.id, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'categoryId' })
  category: Category;
}
