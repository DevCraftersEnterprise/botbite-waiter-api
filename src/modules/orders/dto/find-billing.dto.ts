import { IsDateString, IsOptional, IsUUID, Matches } from 'class-validator';

export class FindBillingDto {
  @IsUUID()
  branchId: string;

  /** Día en la zona horaria de la sucursal. Sin él, hoy. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  @IsDateString({ strict: true })
  date?: string;
}
