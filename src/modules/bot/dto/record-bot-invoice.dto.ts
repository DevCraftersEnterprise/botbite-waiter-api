import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  CFDI_USE_PATTERN,
  normalizeRfc,
  PAYMENT_FORM_PATTERN,
  RFC_PATTERN,
  SAT_UUID_PATTERN,
  TAX_REGIME_PATTERN,
  ZIP_PATTERN,
} from '@/modules/customers/utils/tax.util';

const upper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

/** El receptor, tal como quedó en el CFDI. */
export class BotInvoiceCustomerDto {
  @ApiProperty({ example: 'XAXX010101000' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeRfc(value) : value,
  )
  @Matches(RFC_PATTERN, { message: 'rfc must be a valid RFC' })
  rfc: string;

  @ApiProperty({
    example: 'JUAN PEREZ LOPEZ',
    description: 'Tal como quedó en el CFDI',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  legalName: string;

  @ApiProperty({ example: '83000' })
  @Matches(ZIP_PATTERN, { message: 'zip must have 5 digits' })
  zip: string;

  @ApiProperty({
    example: '612',
    description: 'El régimen con el que se facturó',
  })
  @Matches(TAX_REGIME_PATTERN, { message: 'taxRegime must have 3 digits' })
  taxRegime: string;
}

/** Solo si el comensal eligió guardar sus datos para la próxima vez. */
export class BotTaxProfileConsentDto {
  @ApiProperty({ example: 'cliente@example.com' })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['612', '626'],
    description:
      'Todos los regímenes de la constancia. Sin ellos se guarda solo el de la factura.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @Matches(TAX_REGIME_PATTERN, { each: true })
  taxRegimes?: string[];
}

export class RecordBotInvoiceDto {
  @ApiProperty({
    example: 'C8F3K2M9QZ',
    description: 'El cuenta_id que va en external_id',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  orderCode: string;

  @ApiProperty({
    example: '64f1c2a9e3b4d5f6a7b8c9d0',
    description: 'El id de la factura en FacturAPI',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  providerInvoiceId: string;

  @ApiProperty({
    example: '39C3F0C0-4D2D-4C9A-9B1E-0F6A2B3C4D5E',
    description: 'Folio fiscal del SAT',
  })
  @Transform(upper)
  @Matches(SAT_UUID_PATTERN, { message: 'uuid must be a SAT UUID' })
  uuid: string;

  @ApiProperty({
    example: '123',
    description: 'Serie y folio como se le muestran al comensal',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'number' ? String(value) : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  folio: string;

  @ApiProperty({ example: 220, description: 'Lo facturado, sin propina' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99_999_999)
  total: number;

  @ApiProperty({ example: '04', description: 'Forma de pago del SAT' })
  @Matches(PAYMENT_FORM_PATTERN, { message: 'paymentForm must have 2 digits' })
  paymentForm: string;

  @ApiProperty({ example: 'G03' })
  @Transform(upper)
  @Matches(CFDI_USE_PATTERN, { message: 'cfdiUse must be a CFDI use' })
  cfdiUse: string;

  @ApiPropertyOptional({
    description: 'La fecha de la factura en FacturAPI. Sin ella, la de ahora.',
  })
  @IsOptional()
  @IsDateString()
  issuedAt?: string;

  @ApiPropertyOptional({
    description: 'FacturAPI confirmó el envío por correo',
  })
  @IsOptional()
  @IsBoolean()
  emailSent?: boolean;

  @ApiProperty({ type: BotInvoiceCustomerDto })
  @ValidateNested()
  @Type(() => BotInvoiceCustomerDto)
  customer: BotInvoiceCustomerDto;

  @ApiPropertyOptional({
    type: BotTaxProfileConsentDto,
    description:
      'Mándalo solo si el comensal eligió guardar sus datos. Se guardan con los de `customer` y reemplazan los anteriores.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => BotTaxProfileConsentDto)
  saveTaxProfile?: BotTaxProfileConsentDto;
}
