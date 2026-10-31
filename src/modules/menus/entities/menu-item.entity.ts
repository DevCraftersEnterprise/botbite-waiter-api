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

  /** Agrupa variantes del mismo platillo para que el bot pregunte cuál quiere. */
  @Column({ type: 'varchar', length: 100, nullable: true })
  variantGroup: string | null;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @ManyToOne(() => Menu, (menu) => menu.id)
  @JoinColumn({ name: 'menuId' })
  menu: Menu;

  @ManyToOne(() => Product, (product) => product.id)
  @JoinColumn({ name: 'productId' })
  product: Product;

  @ManyToOne(() => Category, (category) => category.id, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'categoryId' })
  category: Category;
}
