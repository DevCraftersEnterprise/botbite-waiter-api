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

  @ApiProperty({ example: 'America/Hermosillo' })
  timezone: string;

  @ApiProperty({ example: '23:30' })
  dailyCloseTime: string;

  @ApiProperty({ type: String, nullable: true })
  surveyUrl: string | null;

  @ApiProperty({ type: BotFeatures })
  features: BotFeatures;
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
