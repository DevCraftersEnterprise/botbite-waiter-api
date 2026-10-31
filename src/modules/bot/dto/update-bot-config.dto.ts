import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsTimeZone,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { SLUG_PATTERN } from '@/common/utils/slug.util';

export class BranchFeaturesDto {
  @IsOptional()
  @IsBoolean()
  interactiveMenu?: boolean;

  @IsOptional()
  @IsBoolean()
  pdfMenu?: boolean;

  @IsOptional()
  @IsBoolean()
  recommendations?: boolean;

  @IsOptional()
  @IsBoolean()
  wallet?: boolean;

  @IsOptional()
  @IsBoolean()
  mercadoPago?: boolean;

  @IsOptional()
  @IsBoolean()
  invoicing?: boolean;

  @IsOptional()
  @IsBoolean()
  promotions?: boolean;

  @IsOptional()
  @IsBoolean()
  survey?: boolean;
}

/** Lo que cambia la conexión con n8n o lo contratado: solo SUPER/ADMIN. */
export const ADMIN_ONLY_BOT_FIELDS = [
  'slug',
  'whatsappPhoneNumberId',
  'botBaseUrl',
  'features',
] as const;

export class UpdateBotConfigDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  @Matches(SLUG_PATTERN, {
    message: 'slug must be lowercase words separated by hyphens',
  })
  slug?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(/^\d{5,30}$/, { message: 'whatsappPhoneNumberId must be numeric' })
  whatsappPhoneNumberId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(500)
  botBaseUrl?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => BranchFeaturesDto)
  features?: BranchFeaturesDto;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(-90)
  @Max(90)
  latitude?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(-180)
  @Max(180)
  longitude?: number | null;

  @IsOptional()
  @IsBoolean()
  verifyLocation?: boolean;

  // El máximo es amplio porque n8n se prueba desde otra ciudad.
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(5_000_000)
  geofenceMeters?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(120)
  qrCodeMinutes?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  @MaxLength(20, { each: true })
  validTables?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(72)
  sessionHours?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(72)
  postSaleHours?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  maxRecommendations?: number;

  @IsOptional()
  @IsTimeZone()
  timezone?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'dailyCloseTime must have the format HH:mm',
  })
  dailyCloseTime?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUrl({ protocols: ['https', 'http'], require_protocol: true })
  @MaxLength(500)
  surveyUrl?: string | null;
}
