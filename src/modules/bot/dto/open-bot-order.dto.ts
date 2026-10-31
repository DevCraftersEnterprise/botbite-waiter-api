import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { AddRoundDto } from '@/modules/orders/dto/add-round.dto';
import { RoundItemDto } from '@/modules/orders/dto/round-item.dto';

export class OpenBotOrderDto extends AddRoundDto {
  @ApiProperty({
    example: 'C8F3K2M9QZ',
    description: 'cuenta_id del bot. Reenviarlo no crea otra cuenta.',
  })
  @Matches(/^[A-Za-z0-9_-]{4,20}$/, {
    message: 'code must have 4 to 20 letters, numbers, hyphens or underscores',
  })
  code: string;

  @ApiProperty({ example: '5216441223454' })
  @Matches(/^\+?\d{8,15}$/, { message: 'phone must have 8 to 15 digits' })
  phone: string;

  @ApiProperty({ example: 'A5' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  table: string;

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

  @ApiProperty({ type: [RoundItemDto] })
  declare items: RoundItemDto[];
}
