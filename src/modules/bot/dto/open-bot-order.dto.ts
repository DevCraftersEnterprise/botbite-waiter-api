import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { toCoordinate } from '@/common/utils/coordinate.util';
import { AddRoundDto } from '@/modules/orders/dto/add-round.dto';
import { RoundItemDto } from '@/modules/orders/dto/round-item.dto';
import { OrderType } from '@/modules/orders/enums/order.enums';

const isDineIn = (dto: OpenBotOrderDto): boolean =>
  (dto.type ?? OrderType.DINE_IN) === OrderType.DINE_IN;

export class BotDeliveryDto {
  @ApiProperty({ example: 'Calle 5 de Febrero 123, Centro' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  address: string;

  @ApiPropertyOptional({ example: 'Portón negro' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  references?: string;

  @ApiProperty({ example: 27.4912 })
  @Transform(toCoordinate)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({ example: -109.9381 })
  @Transform(toCoordinate)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @ApiProperty({
    example: 42,
    description: 'Lo que el bot cobra de envío. No genera cashback.',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10_000)
  fee: number;
}

export class OpenBotOrderDto extends AddRoundDto {
  @ApiProperty({
    example: 'C8F3K2M9QZ',
    description: 'cuenta_id del bot. Reenviarlo no crea otra cuenta.',
  })
  @Matches(/^[A-Za-z0-9_-]{4,20}$/, {
    message: 'code must have 4 to 20 letters, numbers, hyphens or underscores',
  })
  code: string;

  @ApiPropertyOptional({
    enum: OrderType,
    default: OrderType.DINE_IN,
    description:
      '`pickup` y `delivery` son del número de pedidos: se abren al generar el link de pago y caja no se entera hasta que se pagan.',
  })
  @IsOptional()
  @IsEnum(OrderType)
  type?: OrderType;

  @ApiProperty({ example: '5216441223454' })
  @Matches(/^\+?\d{8,15}$/, { message: 'phone must have 8 to 15 digits' })
  phone: string;

  @ApiPropertyOptional({
    example: 'A5',
    description: 'Obligatoria con `dine_in`; los pedidos no llevan mesa.',
  })
  @ValidateIf(isDineIn)
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  table?: string;

  @ApiPropertyOptional({ example: 'Sergio' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  customerName?: string;

  @ApiPropertyOptional({ example: 'es', default: 'es' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @ApiPropertyOptional({
    default: false,
    description: 'false: caja recibe el aviso "por confirmar con el mesero"',
  })
  @IsOptional()
  @IsBoolean()
  locationVerified?: boolean;

  @ApiPropertyOptional({
    default: false,
    description: 'La mesa ya había pedido una cuenta: es una cuenta aparte',
  })
  @IsOptional()
  @IsBoolean()
  afterPreviousBill?: boolean;

  @ApiPropertyOptional({
    example: '2026-11-10T02:30:00.000Z',
    description: 'Solo pedidos programados de recoger o domicilio.',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  scheduledFor?: string;

  @ApiPropertyOptional({
    type: BotDeliveryDto,
    description: 'Obligatorio con `delivery` y solo con ese tipo.',
  })
  @ValidateIf((dto: OpenBotOrderDto) => dto.type === OrderType.DELIVERY)
  @ValidateNested()
  @Type(() => BotDeliveryDto)
  delivery?: BotDeliveryDto;

  @ApiPropertyOptional({
    example: 0.5,
    description:
      'Comisión de BotBite con la que se generó el link (`ordering.commissionPct`).',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  commissionPct?: number;

  @ApiProperty({ type: [RoundItemDto] })
  declare items: RoundItemDto[];
}
