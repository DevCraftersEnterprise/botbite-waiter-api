import { IsIn } from 'class-validator';
import { RoundStatus } from '@/modules/orders/enums/order.enums';

export class UpdateRoundStatusDto {
  @IsIn([RoundStatus.PREPARING, RoundStatus.DELIVERED, RoundStatus.CANCELLED])
  status: RoundStatus;
}
