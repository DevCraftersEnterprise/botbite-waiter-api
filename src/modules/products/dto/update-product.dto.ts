import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsUrl, MaxLength } from 'class-validator';
import { CreateProductDto } from '@/modules/products/dto/create-product.dto';

export class UpdateProductDto extends PartialType(CreateProductDto) {
  // La imagen se envía por WhatsApp: solo se aceptan URLs https.
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(500)
  imageUrl?: string;
}
