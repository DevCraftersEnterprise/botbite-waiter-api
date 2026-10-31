import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { NotificationType } from '@/modules/notifications/enums/notification-type.enum';

export const BOT_NOTIFICATION_TYPES = [
  NotificationType.ALERT,
  NotificationType.INVOICE,
] as const;

export class CreateBotNotificationDto {
  @ApiProperty({ enum: BOT_NOTIFICATION_TYPES })
  @IsIn(BOT_NOTIFICATION_TYPES)
  type: NotificationType;

  @ApiProperty({ example: '⚠️ Llegó un pago sin cuenta asociada.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  message: string;

  @ApiPropertyOptional({ description: 'Cuenta relacionada, si la hay' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  orderCode?: string;
}
