import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';
import { AddRoundDto } from '@/modules/orders/dto/add-round.dto';
import { RoundItemDto } from '@/modules/orders/dto/round-item.dto';

export class AddBotRoundDto extends AddRoundDto {
  @ApiProperty({
    example: 2,
    minimum: 2,
    description: 'Número de ronda. Reenviarlo no crea otra comanda.',
  })
  @IsInt()
  @Min(2)
  number: number;

  @ApiProperty({ type: [RoundItemDto] })
  declare items: RoundItemDto[];
}
