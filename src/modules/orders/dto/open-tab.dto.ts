import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { AddRoundDto } from '@/modules/orders/dto/add-round.dto';

/** Cuenta que abre el personal desde el panel. */
export class OpenTabDto extends AddRoundDto {
  @IsUUID()
  branchId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  table: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  customerName?: string;
}
