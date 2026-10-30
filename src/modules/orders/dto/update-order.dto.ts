import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateOrderDto } from '@/modules/orders/dto/create-order.dto';

// Un pedido no se puede mover de sucursal ni de cliente.
export class UpdateOrderDto extends PartialType(
  OmitType(CreateOrderDto, ['branchId', 'customerId'] as const),
) {}
