import { ApiPropertyOptional } from '@nestjs/swagger';
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
import {
  FulfillmentStatus,
  OrderStatus,
} from '@/modules/orders/enums/order.enums';

export const BOT_ORDER_STATUSES = [
  OrderStatus.BILL_REQUESTED,
  OrderStatus.PAYMENT_LINK,
  OrderStatus.WITH_WAITER,
  OrderStatus.CANCELLED,
] as const;

/** `pending` lo pone el pago; `cancelled`, la cancelación desde el portal. */
export const BOT_FULFILLMENT_STATUSES = [
  FulfillmentStatus.PREPARING,
  FulfillmentStatus.ON_THE_WAY,
  FulfillmentStatus.READY,
  FulfillmentStatus.DELIVERED,
] as const;

/** Se manda `status` o `fulfillmentStatus`, uno a la vez. */
export class UpdateBotOrderDto {
  @ApiPropertyOptional({
    enum: BOT_ORDER_STATUSES,
    description:
      'Mesa: open → bill_requested → payment_link o with_waiter. Recoger y domicilio: open → payment_link (con `walletUse`), y `cancelled` mientras no se pague (link vencido o carrito cambiado). Repetir el estado actual no hace nada.',
  })
  @IsOptional()
  @IsIn(BOT_ORDER_STATUSES)
  status?: OrderStatus;

  @ApiPropertyOptional({
    enum: BOT_FULFILLMENT_STATUSES,
    description:
      'Solo recoger y domicilio ya pagados: pending → preparing → on_the_way (domicilio) o ready (recoger) → delivered. Repetir el estado actual no hace nada.',
  })
  @IsOptional()
  @IsIn(BOT_FULFILLMENT_STATUSES)
  fulfillmentStatus?: FulfillmentStatus;

  @ApiPropertyOptional({
    enum: WalletUse,
    description:
      'Con `bill_requested` (mesa) o al pasar de `open` a `payment_link` (recoger y domicilio). La API topa el descuento al saldo y al subtotal.',
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
