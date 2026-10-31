import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class FindBotCustomerDto {
  @ApiProperty({
    example: '5216441223454',
    description: 'El wa_id del comensal',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phone: string;
}
