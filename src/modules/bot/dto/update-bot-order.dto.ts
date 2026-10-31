import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { WalletUse } from '@/modules/customers/enums/customer.enums';
import { OrderStatus } from '@/modules/orders/enums/order.enums';

export const BOT_ORDER_STATUSES = [
  OrderStatus.BILL_REQUESTED,
  OrderStatus.PAYMENT_LINK,
  OrderStatus.WITH_WAITER,
] as const;

export class UpdateBotOrderDto {
  @ApiProperty({
    enum: BOT_ORDER_STATUSES,
    description:
      'open → bill_requested → payment_link o with_waiter. Repetir el estado actual no hace nada.',
  })
  @IsIn(BOT_ORDER_STATUSES)
  status: OrderStatus;

  @ApiPropertyOptional({
    enum: WalletUse,
    description:
      'Solo con `bill_requested`. La API topa el descuento al saldo y al subtotal.',
  })
  @IsOptional()
  @IsEnum(WalletUse)
  walletUse?: WalletUse;

  @ApiPropertyOptional({
    example: 50,
    description: 'Obligatorio con `walletUse: amount`.',
  })
  @ValidateIf((dto: UpdateBotOrderDto) => dto.walletUse === WalletUse.AMOUNT)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  walletAmount?: number;

  @ApiPropertyOptional({
    example: 21,
    description: 'Solo con `payment_link`. No se factura ni genera cashback.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99_999)
  tip?: number;
}
