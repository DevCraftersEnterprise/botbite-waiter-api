import { Type } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  CUSTOMER_PROMOS,
  CUSTOMER_STATUSES,
} from '@/modules/customers/utils/customer-report.util';
import type {
  CustomerPromos,
  CustomerStatus,
} from '@/modules/customers/utils/customer-report.util';

export const CUSTOMER_SORTS = [
  'name',
  'visits',
  'firstVisitAt',
  'lastVisitAt',
  'spent',
  'avgTicket',
  'walletBalance',
  'cashbackEarned',
  'promos',
  'status',
] as const;
export type CustomerSort = (typeof CUSTOMER_SORTS)[number];

/** Filtros, búsqueda y orden de la pantalla Clientes. */
export class FindRestaurantCustomersDto {
  @IsOptional()
  @IsPositive()
  @Max(100)
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @Min(0)
  @Type(() => Number)
  offset?: number;

  /** Nombre o teléfono. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(CUSTOMER_STATUSES)
  status?: CustomerStatus;

  @IsOptional()
  @IsIn(CUSTOMER_PROMOS)
  promos?: CustomerPromos;

  @IsOptional()
  @IsIn(CUSTOMER_SORTS)
  sort?: CustomerSort;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}
