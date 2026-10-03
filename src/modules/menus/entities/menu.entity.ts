import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '@/common/database/base.entity';
import { Branch } from '@/modules/branches/entities/branch.entity';
import { MenuItem } from '@/modules/menus/entities/menu-item.entity';

@Entity({ name: 'menus' })
export class Menu extends BaseEntity {
  @Column()
  name: string;

  @Column()
  branchId: string;

  @Column({ nullable: true })
  pdfLink?: string;

  @ManyToOne(() => Branch, (branch) => branch.menus)
  @JoinColumn({ name: 'branchId' })
  branch: Branch;

  @OneToMany(() => MenuItem, (menuItem) => menuItem.menu)
  menuItems: MenuItem[];
}
