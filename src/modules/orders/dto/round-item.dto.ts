import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class RoundItemDto {
  @ApiProperty({
    format: 'uuid',
    description: 'El `id` del catálogo. El precio lo pone la API.',
  })
  @IsUUID()
  menuItemId: string;

  @ApiProperty({ minimum: 1, maximum: 50, example: 2 })
  @IsInt()
  @Min(1)
  @Max(50)
  quantity: number;

  @ApiPropertyOptional({ example: 'sin cebolla' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
