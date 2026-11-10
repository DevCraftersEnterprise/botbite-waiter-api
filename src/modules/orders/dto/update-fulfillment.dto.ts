import { IsIn } from 'class-validator';
import { BOT_FULFILLMENT_STATUSES } from '@/modules/bot/dto/update-bot-order.dto';
import { FulfillmentStatus } from '@/modules/orders/enums/order.enums';

/** Botones de "Para entregar". Cancelar es otra ruta. */
export class UpdateFulfillmentDto {
  @IsIn(BOT_FULFILLMENT_STATUSES)
  status: FulfillmentStatus;
}
