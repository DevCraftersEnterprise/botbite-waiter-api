import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/common/database/base.entity';
import { RestaurantCustomer } from '@/modules/customers/entities/restaurant-customer.entity';

/**
 * Datos fiscales que el comensal pidió guardar para su próxima factura en este
 * restaurante. Solo se escriben cuando el SAT aceptó una factura con ellos, y
 * al pedir que se borren se eliminan de verdad, sin `deletedAt`.
 */
@Entity({ name: 'customer_tax_profiles' })
@Index('UQ_customer_tax_profiles', ['restaurantCustomerId'], { unique: true })
export class CustomerTaxProfile extends BaseEntity {
  @Column({ type: 'varchar', length: 13 })
  rfc: string;

  @Column({ type: 'varchar', length: 300 })
  legalName: string;

  @Column({ type: 'varchar', length: 5 })
  zip: string;

  /** Todos los regímenes de su constancia. */
  @Column({ type: 'text', array: true, default: '{}' })
  taxRegimes: string[];

  /** El que eligió para facturar. */
  @Column({ type: 'varchar', length: 3 })
  taxRegime: string;

  @Column({ type: 'varchar', length: 4 })
  cfdiUse: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  /** Cuándo aceptó que se guardaran. */
  @Column({ type: 'timestamptz' })
  consentAt: Date;

  @Column({ type: 'uuid' })
  restaurantCustomerId: string;

  @ManyToOne(() => RestaurantCustomer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurantCustomerId' })
  restaurantCustomer: RestaurantCustomer;
}
