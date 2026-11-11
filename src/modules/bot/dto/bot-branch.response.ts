import { ApiProperty } from '@nestjs/swagger';

export class BotRestaurant {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'punto-de-union' })
  slug: string;

  @ApiProperty({ example: 'PUNTO DE UNION' })
  name: string;

  @ApiProperty({
    example: 5,
    description: 'Porcentaje de cashback del monedero',
  })
  walletPct: number;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'https://res.cloudinary.com/botbite/image/upload/logo.png',
    description: 'Logo cuadrado del restaurante; null si no tiene',
  })
  logoUrl: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'https://restaurante.mx/privacidad',
    description:
      'Aviso de privacidad del restaurante. El de BotBite se muestra siempre; este se agrega si existe',
  })
  privacyUrl: string | null;
}

export class BotFeatures {
  @ApiProperty()
  interactiveMenu: boolean;

  @ApiProperty()
  pdfMenu: boolean;

  @ApiProperty()
  recommendations: boolean;

  @ApiProperty()
  wallet: boolean;

  @ApiProperty()
  mercadoPago: boolean;

  @ApiProperty()
  invoicing: boolean;

  @ApiProperty()
  promotions: boolean;

  @ApiProperty()
  survey: boolean;

  @ApiProperty({
    description:
      'Pregunta el idioma al cliente. Apagado: atiende solo en español y pide la mesa directo',
  })
  languages: boolean;
}

export class BotOrderingDelivery {
  @ApiProperty({ example: 30, description: 'Costo hasta `includedKm`' })
  baseFee: number;

  @ApiProperty({ example: 4 })
  includedKm: number;

  @ApiProperty({ example: 1, description: 'Por cada 100 m extra' })
  extraPer100m: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 8.5,
    description: 'En línea recta; null: sin límite',
  })
  maxKm: number | null;
}

export class BotNoDeliveryZone {
  @ApiProperty({ example: 'Colonia X (de noche)' })
  name: string;

  @ApiProperty({ example: 27.52 })
  latitude: number;

  @ApiProperty({ example: -109.94 })
  longitude: number;

  @ApiProperty({ example: 500 })
  radiusMeters: number;

  @ApiProperty({
    type: [Number],
    example: [5, 6],
    description: '0 = domingo. Vacío: todos los días',
  })
  days: number[];

  @ApiProperty({
    type: String,
    nullable: true,
    example: '21:00',
    description:
      'Con `to`, puede cruzar la medianoche. Los dos null: todo el día',
  })
  from: string | null;

  @ApiProperty({ type: String, nullable: true, example: '06:00' })
  to: string | null;
}

export class BotOrderingHours {
  @ApiProperty({ type: [Number], example: [0, 1, 2, 3, 4, 5, 6] })
  days: number[];

  @ApiProperty({ example: '18:00' })
  opens: string;

  @ApiProperty({
    example: '23:00',
    description: 'Si es menor que `opens`, cierra al día siguiente',
  })
  closes: string;
}

export class BotOrderingScheduling {
  @ApiProperty()
  enabled: boolean;

  @ApiProperty({ example: 1, description: '1 = hoy y mañana' })
  maxDays: number;

  @ApiProperty({ example: 45 })
  minLeadMinutes: number;

  @ApiProperty({ example: 30 })
  stepMinutes: number;

  @ApiProperty({
    example: 30,
    description: 'Recordatorio a caja antes de la hora programada',
  })
  reminderMinutes: number;

  @ApiProperty({
    example: 60,
    description: 'Hasta cuántos minutos antes puede cancelar el cliente',
  })
  cancelUntilMinutes: number;
}

export class BotOrdering {
  @ApiProperty({ description: 'La sucursal tiene el modo pedidos' })
  enabled: boolean;

  @ApiProperty({ description: 'Interruptor "Recibiendo pedidos"' })
  accepting: boolean;

  @ApiProperty({ type: String, nullable: true, example: '123456789012345' })
  phoneNumberId: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '5216441110000',
    description: 'Tal como lo muestra WhatsApp',
  })
  phoneNumber: string | null;

  @ApiProperty({
    enum: ['pickup', 'delivery'],
    isArray: true,
    example: ['pickup', 'delivery'],
  })
  types: string[];

  @ApiProperty({ type: BotOrderingDelivery })
  delivery: BotOrderingDelivery;

  @ApiProperty({ type: [BotNoDeliveryZone] })
  noDeliveryZones: BotNoDeliveryZone[];

  @ApiProperty({
    type: [BotOrderingHours],
    description: 'En la zona horaria de la sucursal (`timezone`)',
  })
  hours: BotOrderingHours[];

  @ApiProperty({ type: BotOrderingScheduling })
  scheduling: BotOrderingScheduling;

  @ApiProperty({
    example: 0.5,
    description: 'Comisión de BotBite sobre el total, envío incluido',
  })
  commissionPct: number;

  @ApiProperty({ example: 60 })
  paymentLinkMinutes: number;

  @ApiProperty({ example: 20 })
  prepMinutes: number;
}

export class BotBranchConfig {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'cocorit' })
  slug: string;

  @ApiProperty({ example: 'Cocorit' })
  name: string;

  @ApiProperty({ type: String, nullable: true, example: '+526441223454' })
  phoneNumberAssistant: string | null;

  @ApiProperty({ type: String, nullable: true, example: '+526441160044' })
  phoneNumberReception: string | null;

  @ApiProperty({ type: String, nullable: true })
  whatsappPhoneNumberId: string | null;

  @ApiProperty({ type: String, nullable: true })
  botBaseUrl: string | null;

  @ApiProperty({ type: Number, nullable: true, example: 27.535038 })
  latitude: number | null;

  @ApiProperty({ type: Number, nullable: true, example: -109.954031 })
  longitude: number | null;

  @ApiProperty()
  verifyLocation: boolean;

  @ApiProperty({ example: 200 })
  geofenceMeters: number;

  @ApiProperty({ example: 10 })
  qrCodeMinutes: number;

  @ApiProperty({
    type: [String],
    description: 'Vacío: acepta cualquier mesa',
    example: ['1', '2', 'A3'],
  })
  validTables: string[];

  @ApiProperty({ example: 16 })
  sessionHours: number;

  @ApiProperty({ example: 3 })
  postSaleHours: number;

  @ApiProperty({ example: 4 })
  maxRecommendations: number;

  @ApiProperty({
    example: 'America/Hermosillo',
    description:
      'De la sucursal: la usan el mesero (`hours`, `dailyCloseTime`) y los pedidos (`ordering.hours`)',
  })
  timezone: string;

  @ApiProperty({
    example: '23:30',
    description:
      '"Cierre del día" del mesero. No es su horario: ese va en `hours`',
  })
  dailyCloseTime: string;

  @ApiProperty({
    type: [BotOrderingHours],
    description:
      'Horario del mesero, en la zona horaria de la sucursal. Vacío: atiende siempre',
    example: [
      { days: [1, 2, 3, 4, 5, 6], opens: '13:00', closes: '01:00' },
      { days: [0], opens: '13:00', closes: '20:00' },
    ],
  })
  hours: BotOrderingHours[];

  @ApiProperty({
    example: 0.5,
    description:
      'Comisión de BotBite en los pagos del mesero (`marketplace_fee`, en %), sobre el `amountDue`. 0: sin comisión',
  })
  commissionPct: number;

  @ApiProperty({ type: String, nullable: true })
  surveyUrl: string | null;

  @ApiProperty({ type: BotFeatures })
  features: BotFeatures;

  @ApiProperty({
    type: BotOrdering,
    nullable: true,
    description:
      'Modo pedidos (recoger y domicilio). null: la sucursal no lo tiene',
  })
  ordering: BotOrdering | null;
}

export class BotCatalogItem {
  @ApiProperty({
    format: 'uuid',
    description: 'Id del item de menú; es el que se usa al enviar comandas',
  })
  id: string;

  @ApiProperty({ example: 'CHIPS DE CAMOTE' })
  name: string;

  @ApiProperty({ example: 'CHIPS DE CAMOTE SAZONADAS' })
  description: string;

  @ApiProperty({ example: 95 })
  price: number;

  @ApiProperty({ example: 'BOTANAS' })
  category: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'PIZZA BONELESS',
    description: 'Agrupa variantes del mismo platillo',
  })
  variantGroup: string | null;

  @ApiProperty({
    description: 'false: el bot responde que no lo tiene y lo oculta del menú',
  })
  isActive: boolean;

  @ApiProperty({ description: 'El bot lo recomienda (corazón del portal)' })
  isRecommended: boolean;

  @ApiProperty({ type: String, nullable: true })
  imageUrl: string | null;
}

export class BotBranchResponse {
  @ApiProperty({ type: BotRestaurant })
  restaurant: BotRestaurant;

  @ApiProperty({ type: BotBranchConfig })
  branch: BotBranchConfig;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'PDF del menú activo de la sucursal',
  })
  menuPdfUrl: string | null;

  @ApiProperty({
    type: [BotCatalogItem],
    description:
      'Ordenado por categoría y posición. Incluye los platillos apagados.',
  })
  catalog: BotCatalogItem[];
}
