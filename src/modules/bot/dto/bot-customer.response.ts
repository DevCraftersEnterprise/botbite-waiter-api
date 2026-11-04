import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PromosStatus } from '@/modules/customers/enums/customer.enums';

export class BotTaxProfile {
  @ApiProperty({ example: 'XAXX010101000' })
  rfc: string;

  @ApiProperty({ example: 'JUAN PEREZ LOPEZ' })
  legalName: string;

  @ApiProperty({ example: '83000' })
  zip: string;

  @ApiProperty({ type: [String], example: ['612', '626'] })
  taxRegimes: string[];

  @ApiProperty({ example: '612' })
  taxRegime: string;

  @ApiProperty({ example: 'G03' })
  cfdiUse: string;

  @ApiProperty({ example: 'cliente@example.com' })
  email: string;

  @ApiProperty({ description: 'Cuándo aceptó guardarlos' })
  consentAt: Date;
}

export class BotCustomerResponse {
  @ApiProperty({ description: 'false: nunca ha venido a este restaurante' })
  known: boolean;

  @ApiProperty({ example: 'Sergio' })
  name: string;

  @ApiProperty({ example: 3 })
  visits: number;

  @ApiProperty({ type: Date, nullable: true })
  firstVisitAt: Date | null;

  @ApiProperty({ type: Date, nullable: true })
  lastVisitAt: Date | null;

  @ApiProperty({ enum: PromosStatus })
  promos: PromosStatus;

  @ApiProperty({ type: Date, nullable: true })
  promosAt: Date | null;

  @ApiProperty({ type: Date, nullable: true })
  unsubscribedAt: Date | null;

  @ApiProperty({
    example: 42.5,
    description: 'Se comparte entre las sucursales del restaurante',
  })
  walletBalance: number;

  @ApiProperty({
    description: 'Tiene datos fiscales guardados en este restaurante',
  })
  hasTaxProfile: boolean;

  @ApiPropertyOptional({
    type: BotTaxProfile,
    nullable: true,
    description:
      'Solo con `includeTaxProfile: true`. Vacío si no hay datos guardados.',
  })
  taxProfile?: BotTaxProfile | null;
}
