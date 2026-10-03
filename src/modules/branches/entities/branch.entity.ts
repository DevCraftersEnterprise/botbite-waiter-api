import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '@/common/database/base.entity';
import { Restaurant } from '@/modules/restaurants/entities/restaurant.entity';
import { Menu } from '@/modules/menus/entities/menu.entity';

@Entity('branches')
export class Branch extends BaseEntity {
  @Column()
  name: string;

  @Column()
  address: string;

  @Column({ type: 'varchar', nullable: true })
  phoneNumberAssistant: string | null;

  @Column({ type: 'varchar', nullable: true })
  phoneNumberReception: string | null;

  @Column({ type: 'varchar', nullable: true })
  qrUrl: string | null;

  @Column({ type: 'varchar', nullable: true })
  surveyUrl: string | null;

  @Column({ type: 'int', default: 0 })
  availableMessages: number;

  @Column({ type: 'varchar', nullable: true })
  qrToken: string | null;

  @Column()
  restaurantId: string;

  @ManyToOne(() => Restaurant, (restaurant) => restaurant.branches)
  @JoinColumn({ name: 'restaurantId' })
  restaurant: Restaurant;

  @OneToMany(() => Menu, (menu) => menu.branch)
  menus: Menu[];
}
