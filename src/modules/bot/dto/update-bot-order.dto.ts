import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
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
}
