import { ApiProperty } from '@nestjs/swagger';
import { BotOrder } from '@/modules/bot/dto/bot-order.response';
import { PaymentStatus } from '@/modules/orders/enums/order.enums';

export class BotPaymentResponse {
  @ApiProperty({
    description: 'false: era un reintento y no se procesó de nuevo',
  })
  created: boolean;

  @ApiProperty({
    enum: PaymentStatus,
    description:
      '`approved`: cerró la cuenta. `incomplete`: llegó de menos y la cuenta sigue abierta. `unmatched`: la cuenta no existe o ya estaba cerrada. En los dos últimos, caja recibe una alerta.',
  })
  status: PaymentStatus;

  @ApiProperty({ example: 10.5, description: 'Lo que ganó el comensal' })
  cashback: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 42.5,
    description: 'Saldo después del pago. Vacío si no hay cliente',
  })
  walletBalance: number | null;

  @ApiProperty({ type: BotOrder, nullable: true })
  order: BotOrder | null;
}

export class BotDailyCloseResponse {
  @ApiProperty({
    type: [String],
    example: ['C8F3K2M9QZ'],
    description: 'Códigos de las cuentas que se cerraron',
  })
  closed: string[];
}
