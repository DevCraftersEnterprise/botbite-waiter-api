import { ApiProperty } from '@nestjs/swagger';

export class BotInvoice {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: '64f1c2a9e3b4d5f6a7b8c9d0' })
  providerInvoiceId: string;

  @ApiProperty({ example: '39C3F0C0-4D2D-4C9A-9B1E-0F6A2B3C4D5E' })
  uuid: string;

  @ApiProperty({ example: '123' })
  folio: string;

  @ApiProperty({ example: 220 })
  total: number;

  @ApiProperty()
  issuedAt: Date;

  @ApiProperty({ type: String, nullable: true, example: 'C8F3K2M9QZ' })
  orderCode: string | null;
}

export class BotInvoiceResponse {
  @ApiProperty({
    description: 'false: era un reintento y no se procesó de nuevo',
  })
  created: boolean;

  @ApiProperty({
    description:
      'true: la cuenta ya tenía otra factura. Se registró igual y caja recibió una alerta.',
  })
  repeated: boolean;

  @ApiProperty({
    description:
      'El comensal tiene datos fiscales guardados después de esta factura',
  })
  hasTaxProfile: boolean;

  @ApiProperty({ type: BotInvoice })
  invoice: BotInvoice;
}
