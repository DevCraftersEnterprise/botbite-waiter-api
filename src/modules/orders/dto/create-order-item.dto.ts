import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
} from 'class-validator';

export class CreateOrderItemDto {
  @IsUUID()
  menuItemId: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(1_000_000)
  @Type(() => Number)
  price: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
