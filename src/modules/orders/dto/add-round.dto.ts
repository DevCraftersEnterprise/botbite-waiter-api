import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { RoundItemDto } from '@/modules/orders/dto/round-item.dto';

export class AddRoundDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => RoundItemDto)
  items: RoundItemDto[];
}
