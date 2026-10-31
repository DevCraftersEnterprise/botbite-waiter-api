import { ApiProperty } from '@nestjs/swagger';
import { PromosStatus } from '@/modules/customers/enums/customer.enums';

export class BotCustomerResponse {
  @ApiProperty({ description: 'false: nunca ha venido a este restaurante' })
  known: boolean;

  @ApiProperty({ example: 'Sergio' })
  name: string;

  @ApiProperty({ example: 3 })
  visits: number;

  @ApiProperty({ type: Date, nullable: true })
  firstVisitAt: Date | null;

  @ApiProperty({ type: Date, nullable: true })
  lastVisitAt: Date | null;

  @ApiProperty({ enum: PromosStatus })
  promos: PromosStatus;

  @ApiProperty({ type: Date, nullable: true })
  promosAt: Date | null;

  @ApiProperty({ type: Date, nullable: true })
  unsubscribedAt: Date | null;

  @ApiProperty({
    example: 42.5,
    description: 'Se comparte entre las sucursales del restaurante',
  })
  walletBalance: number;
}
