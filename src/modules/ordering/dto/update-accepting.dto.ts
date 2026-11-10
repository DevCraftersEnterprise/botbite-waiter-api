import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateAcceptingDto {
  @ApiProperty({
    description:
      'false: no se toman pedidos nuevos (caja escribió *pausar*); los que van en curso siguen',
  })
  @IsBoolean()
  accepting: boolean;
}

export class AcceptingResponse {
  @ApiProperty()
  accepting: boolean;
}
