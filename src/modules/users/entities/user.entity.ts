import { BaseEntity } from '@/common/database/base.entity';
import { UserRoles } from '@/core/auth/enums/user-roles.enum';
import { Restaurant } from '@/modules/restaurants/entities/restaurant.entity';
import { Exclude } from 'class-transformer';
import { BeforeInsert, BeforeUpdate, Column, Entity, OneToMany } from 'typeorm';

@Entity({ name: 'users' })
export class User extends BaseEntity {
  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ length: 255, select: false })
  @Exclude()
  password: string;

  @Column({
    type: 'enum',
    enum: UserRoles,
    array: true,
    default: [UserRoles.USER],
  })
  roles: UserRoles[];

  @OneToMany(() => Restaurant, (restaurant) => restaurant.user, {
    cascade: true,
    eager: false,
  })
  restaurants: Restaurant[];

  @BeforeInsert()
  @BeforeUpdate()
  normalizeEmail() {
    // En updates parciales el email puede no venir cargado.
    if (this.email) this.email = this.email.trim().toLowerCase();
  }
}
