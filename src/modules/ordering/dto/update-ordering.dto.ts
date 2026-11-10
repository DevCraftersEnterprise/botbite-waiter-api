import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
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
import { ORDERING_TYPES, OrderType } from '@/modules/orders/enums/order.enums';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const TIME_MESSAGE = (field: string) => ({
  message: `${field} must have the format HH:mm`,
});

const MONEY = { maxDecimalPlaces: 2 };

export class OrderingDeliveryDto {
  @IsOptional()
  @IsNumber(MONEY)
  @Min(0)
  @Max(10_000)
  baseFee?: number;

  @IsOptional()
  @IsNumber(MONEY)
  @Min(0)
  @Max(100)
  includedKm?: number;

  @IsOptional()
  @IsNumber(MONEY)
  @Min(0)
  @Max(1_000)
  extraPer100m?: number;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber(MONEY)
  @Min(0.1)
  @Max(500)
  maxKm?: number | null;
}

export class NoDeliveryZoneDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  @Transform(toCoordinate)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @Transform(toCoordinate)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @IsInt()
  @Min(10)
  @Max(50_000)
  radiusMeters: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  days?: number[];

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(TIME, TIME_MESSAGE('from'))
  from?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(TIME, TIME_MESSAGE('to'))
  to?: string | null;
}

export class OrderingHoursDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  days: number[];

  @Matches(TIME, TIME_MESSAGE('opens'))
  opens: string;

  @Matches(TIME, TIME_MESSAGE('closes'))
  closes: string;
}

export class OrderingSchedulingDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(7)
  maxDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2_880)
  minLeadMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(240)
  stepMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(240)
  reminderMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2_880)
  cancelUntilMinutes?: number;
}

/** Lo que contrata la sucursal y lo que cobra BotBite: solo SUPER/ADMIN. */
export const ADMIN_ONLY_ORDERING_FIELDS = [
  'enabled',
  'phoneNumberId',
  'phoneNumber',
  'commissionPct',
] as const;

/** Las listas (zonas y horario) se reemplazan completas; lo demás se combina. */
export class UpdateOrderingDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  accepting?: boolean;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(/^\d{5,30}$/, { message: 'phoneNumberId must be numeric' })
  phoneNumberId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(/^\+?\d{8,15}$/, { message: 'phoneNumber must have 8 to 15 digits' })
  phoneNumber?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(ORDERING_TYPES, { each: true })
  types?: OrderType[];

  @IsOptional()
  @ValidateNested()
  @Type(() => OrderingDeliveryDto)
  delivery?: OrderingDeliveryDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => NoDeliveryZoneDto)
  noDeliveryZones?: NoDeliveryZoneDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(21)
  @ValidateNested({ each: true })
  @Type(() => OrderingHoursDto)
  hours?: OrderingHoursDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => OrderingSchedulingDto)
  scheduling?: OrderingSchedulingDto;

  @IsOptional()
  @IsNumber(MONEY)
  @Min(0)
  @Max(100)
  commissionPct?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(1_440)
  paymentLinkMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(240)
  prepMinutes?: number;
}
