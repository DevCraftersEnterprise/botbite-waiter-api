import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { SLUG_PATTERN } from '@/common/utils/slug.util';
import { CreateRestaurantDto } from '@/modules/restaurants/dto/create-restaurant.dto';

export class UpdateRestaurantDto extends PartialType(CreateRestaurantDto) {
  /** Solo SUPER/ADMIN: el mesero lo usa para identificar el monedero. */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  @Matches(SLUG_PATTERN, {
    message: 'slug must be lowercase words separated by hyphens',
  })
  slug?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  @Type(() => Number)
  walletPct?: number;

  /** Aviso de privacidad del restaurante; null lo quita. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(500)
  privacyUrl?: string | null;
}
