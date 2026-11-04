import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { FindBotCustomerDto } from '@/modules/bot/dto/find-bot-customer.dto';

export class LookupBotCustomerDto extends FindBotCustomerDto {
  @ApiPropertyOptional({
    description:
      'Pídelo solo cuando el comensal quiere factura: agrega `taxProfile` a la respuesta.',
  })
  @IsOptional()
  @IsBoolean()
  includeTaxProfile?: boolean;
}
