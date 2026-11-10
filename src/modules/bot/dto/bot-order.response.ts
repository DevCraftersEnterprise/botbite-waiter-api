import { ApiProperty } from '@nestjs/swagger';
import {
  FulfillmentStatus,
  OrderSource,
  OrderStatus,
  OrderType,
  PaymentMethod,
  RoundStatus,
} from '@/modules/orders/enums/order.enums';

export class BotRoundItem {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  menuItemId: string;

  @ApiProperty({ type: String, nullable: true, example: 'CHIPS DE CAMOTE' })
  name: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'BOTANAS' })
  category: string | null;

  @ApiProperty({ example: 2 })
  quantity: number;

  @ApiProperty({ example: 95, description: 'Precio unitario vigente' })
  price: number;

  @ApiProperty({ type: String, nullable: true, example: 'sin cebolla' })
  note: string | null;
}

export class BotRound {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 1 })
  number: number;

  @ApiProperty({ enum: RoundStatus })
  status: RoundStatus;

  @ApiProperty()
  sentAt: Date;

  @ApiProperty({ type: Date, nullable: true })
  acknowledgedAt: Date | null;

  @ApiProperty({ type: Date, nullable: true })
  deliveredAt: Date | null;

  @ApiProperty({ type: [BotRoundItem] })
  items: BotRoundItem[];
}

export class BotDelivery {
  @ApiProperty({ type: String, nullable: true })
  address: string | null;

  @ApiProperty({ type: String, nullable: true })
  references: string | null;

  @ApiProperty({ type: Number, nullable: true })
  latitude: number | null;

  @ApiProperty({ type: Number, nullable: true })
  longitude: number | null;
}

export class BotOrder {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ type: String, nullable: true, example: 'C8F3K2M9QZ' })
  code: string | null;

  @ApiProperty({ enum: OrderSource })
  source: OrderSource;

  @ApiProperty({ enum: OrderStatus })
  status: OrderStatus;

  @ApiProperty({ type: String, nullable: true, example: 'A5' })
  table: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Sergio' })
  customerName: string | null;

  @ApiProperty({ example: 'es' })
  language: string;

  @ApiProperty()
  locationVerified: boolean;

  @ApiProperty()
  openedAt: Date;

  @ApiProperty({ type: Date, nullable: true })
  billRequestedAt: Date | null;

  @ApiProperty({ type: Date, nullable: true })
  closedAt: Date | null;

  @ApiProperty({ example: 210 })
  subtotal: number;

  @ApiProperty({ example: 0 })
  walletDiscount: number;

  @ApiProperty({ example: 210, description: 'Subtotal menos monedero' })
  total: number;

  @ApiProperty({ example: 0 })
  tip: number;

  @ApiProperty({ example: 210, description: 'Total, propina y envío' })
  amountDue: number;

  @ApiProperty({ enum: PaymentMethod, nullable: true })
  paymentMethod: PaymentMethod | null;

  @ApiProperty({ enum: OrderType })
  type: OrderType;

  @ApiProperty({
    enum: FulfillmentStatus,
    nullable: true,
    description: 'Solo recoger y domicilio, desde que se pagan',
  })
  fulfillmentStatus: FulfillmentStatus | null;

  @ApiProperty({ type: Date, nullable: true })
  fulfillmentUpdatedAt: Date | null;

  @ApiProperty({ type: Date, nullable: true })
  scheduledFor: Date | null;

  @ApiProperty({ example: 0 })
  deliveryFee: number;

  @ApiProperty({ type: Number, nullable: true, example: 0.5 })
  commissionPct: number | null;

  @ApiProperty({
    type: BotDelivery,
    nullable: true,
    description: 'Solo domicilio. La dirección se borra 30 días después',
  })
  delivery: BotDelivery | null;
}

export class BotRoundResponse {
  @ApiProperty({
    description: 'false: era un reintento y no se creó nada nuevo',
  })
  created: boolean;

  @ApiProperty({ type: BotOrder })
  order: BotOrder;

  @ApiProperty({ type: BotRound })
  round: BotRound;
}

export class BotOrderResponse {
  @ApiProperty({ type: BotOrder })
  order: BotOrder;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 12.5,
    description:
      'Saldo que le queda al comensal. Vacío si la cuenta no tiene cliente',
  })
  walletBalance: number | null;

  @ApiProperty({
    description: 'Pidió más saldo del que tiene: se usó el saldo completo',
  })
  walletCapped: boolean;
}
