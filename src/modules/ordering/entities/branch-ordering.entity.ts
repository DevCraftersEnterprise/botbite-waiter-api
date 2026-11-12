import { Check, Column, Entity, Index, JoinColumn, OneToOne } from 'typeorm';
import { BaseEntity } from '@/common/database/base.entity';
import { Branch } from '@/modules/branches/entities/branch.entity';
import { DEFAULT_SCHEDULING } from '@/modules/ordering/interfaces/ordering.interfaces';
import type {
  NoDeliveryZone,
  OrderingHours,
  OrderingScheduling,
} from '@/modules/ordering/interfaces/ordering.interfaces';
import { OrderType } from '@/modules/orders/enums/order.enums';

/**
 * Modo pedidos de una sucursal (recoger y domicilio con pago por adelantado).
 * Comparte la llave, la URL base y el catálogo con el mesero, pero tiene su
 * propio número de WhatsApp y su propio horario.
 */
@Entity('branch_ordering')
@Check(
  'CHK_branch_ordering_commission',
  `"commissionPct" >= 0 AND "commissionPct" <= 100`,
)
export class BranchOrdering extends BaseEntity {
  /**
   * Una por sucursal: el `@OneToOne` crea la constraint única. TypeORM no deja
   * darle nombre, así que lleva el de su estrategia (UQ_211ac65b…, ver la
   * migración AlignEntitiesWithSchema).
   */
  @Column({ type: 'uuid' })
  branchId: string;

  @OneToOne(() => Branch, (branch) => branch.ordering, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'branchId',
    foreignKeyConstraintName: 'FK_branch_ordering_branch',
  })
  branch: Branch;

  /** Lo contrató la sucursal. Solo lo cambia BotBite. */
  @Column({ type: 'boolean', default: false })
  enabled: boolean;

  /** Interruptor "Recibiendo pedidos": equivale a *pausar* / *activar* en caja. */
  @Column({ type: 'boolean', default: true })
  accepting: boolean;

  @Index('UQ_branch_ordering_phoneNumberId', { unique: true })
  @Column({ type: 'varchar', length: 30, nullable: true })
  phoneNumberId: string | null;

  /** Tal como lo muestra WhatsApp (en celulares mexicanos, `521…`). */
  @Column({ type: 'varchar', length: 16, nullable: true })
  phoneNumber: string | null;

  @Column({ type: 'text', array: true, default: '{pickup,delivery}' })
  types: OrderType[];

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  deliveryBaseFee: number;

  @Column({ type: 'numeric', precision: 6, scale: 2, default: 0 })
  deliveryIncludedKm: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  deliveryExtraPer100m: number;

  /** En línea recta. null: sin límite. */
  @Column({ type: 'numeric', precision: 6, scale: 2, nullable: true })
  deliveryMaxKm: number | null;

  @Column({ type: 'jsonb', default: () => `'[]'` })
  noDeliveryZones: NoDeliveryZone[];

  @Column({ type: 'jsonb', default: () => `'[]'` })
  hours: OrderingHours[];

  @Column({ type: 'jsonb', default: DEFAULT_SCHEDULING })
  scheduling: OrderingScheduling;

  /** Comisión de BotBite sobre el total, envío incluido. Solo la cambia BotBite. */
  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  commissionPct: number;

  @Column({ type: 'int', default: 60 })
  paymentLinkMinutes: number;

  @Column({ type: 'int', default: 20 })
  prepMinutes: number;
}
