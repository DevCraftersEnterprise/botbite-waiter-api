import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { FindBotCustomerDto } from '@/modules/bot/dto/find-bot-customer.dto';
import { PromosStatus } from '@/modules/customers/enums/customer.enums';

export const BOT_PROMOS_ANSWERS = [
  PromosStatus.ACCEPTED,
  PromosStatus.DECLINED,
] as const;

export class UpdateBotCustomerDto extends FindBotCustomerDto {
  @ApiPropertyOptional({ example: 'Sergio' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ enum: BOT_PROMOS_ANSWERS })
  @IsOptional()
  @IsIn(BOT_PROMOS_ANSWERS)
  promos?: PromosStatus;

  @ApiPropertyOptional({ description: 'Escribió BAJA' })
  @IsOptional()
  @IsBoolean()
  unsubscribed?: boolean;
}
