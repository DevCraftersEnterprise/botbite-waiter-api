import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '@/common/database/base.entity';
import { Restaurant } from '@/modules/restaurants/entities/restaurant.entity';
import { Menu } from '@/modules/menus/entities/menu.entity';

/** Funciones del mesero que contrata cada sucursal. */
export interface BranchFeatures {
  interactiveMenu: boolean;
  pdfMenu: boolean;
  recommendations: boolean;
  wallet: boolean;
  mercadoPago: boolean;
  invoicing: boolean;
  promotions: boolean;
  survey: boolean;
}

export const DEFAULT_BRANCH_FEATURES: BranchFeatures = {
  interactiveMenu: true,
  pdfMenu: false,
  recommendations: true,
  wallet: true,
  mercadoPago: true,
  invoicing: true,
  promotions: true,
  survey: true,
};

@Entity('branches')
@Check(
  'CHK_branches_location',
  `NOT "verifyLocation" OR ("latitude" IS NOT NULL AND "longitude" IS NOT NULL)`,
)
export class Branch extends BaseEntity {
  @Column()
  name: string;

  /** Único en la plataforma: es parte del QR, del webhook y del prefijo de Redis. */
  @Index('UQ_branches_slug', { unique: true })
  @Column({ type: 'varchar', length: 60 })
  slug: string;

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

  @Index('UQ_branches_whatsappPhoneNumberId', { unique: true })
  @Column({ type: 'varchar', length: 30, nullable: true })
  whatsappPhoneNumberId: string | null;

  /** URL base de los webhooks de n8n de esta sucursal. */
  @Column({ type: 'varchar', nullable: true })
  botBaseUrl: string | null;

  @Column({ type: 'numeric', precision: 9, scale: 6, nullable: true })
  latitude: number | null;

  @Column({ type: 'numeric', precision: 9, scale: 6, nullable: true })
  longitude: number | null;

  @Column({ type: 'boolean', default: false })
  verifyLocation: boolean;

  @Column({ type: 'int', default: 200 })
  geofenceMeters: number;

  @Column({ type: 'int', default: 10 })
  qrCodeMinutes: number;

  /** Vacío: acepta cualquier mesa. */
  @Column({ type: 'text', array: true, default: '{}' })
  validTables: string[];

  @Column({ type: 'int', default: 16 })
  sessionHours: number;

  @Column({ type: 'int', default: 3 })
  postSaleHours: number;

  @Column({ type: 'int', default: 4 })
  maxRecommendations: number;

  @Column({ type: 'varchar', length: 40, default: 'America/Hermosillo' })
  timezone: string;

  @Column({ type: 'time', default: '23:30:00' })
  dailyCloseTime: string;

  @Column({ type: 'jsonb', default: DEFAULT_BRANCH_FEATURES })
  features: BranchFeatures;

  @Column()
  restaurantId: string;

  @ManyToOne(() => Restaurant, (restaurant) => restaurant.branches)
  @JoinColumn({ name: 'restaurantId' })
  restaurant: Restaurant;

  @OneToMany(() => Menu, (menu) => menu.branch)
  menus: Menu[];
}
