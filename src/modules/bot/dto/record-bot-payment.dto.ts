import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class RecordBotPaymentDto {
  @ApiPropertyOptional({
    example: 'C8F3K2M9QZ',
    description:
      'El cuenta_id de external_reference. Sin él, o si no existe en la sucursal, el pago queda sin cuenta y se avisa a caja.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  orderCode?: string;

  @ApiProperty({
    example: '1234567890',
    description: 'El id del pago en Mercado Pago',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  providerPaymentId: string;

  @ApiProperty({
    example: 231,
    description: 'El transaction_amount que reportó Mercado Pago',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ example: 'credit_card' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  paymentType?: string;
}
