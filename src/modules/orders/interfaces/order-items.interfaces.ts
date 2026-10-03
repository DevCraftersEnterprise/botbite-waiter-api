import { Repository } from 'typeorm';
import { CreateOrderItemDto } from '@/modules/orders/dto/create-order-item.dto';
import { OrderItem } from '@/modules/orders/entities/order-item.entity';
import { TranslationService } from '@/common/services/translation.service';
import { Logger } from '@nestjs/common';
import { Order } from '@/modules/orders/entities/order.entity';

export interface CreateOrderItem {
  orderId: string;
  dto: CreateOrderItemDto;
  lang: string;
  orderRepository: Repository<Order>;
  orderItemRepository: Repository<OrderItem>;
  translationService: TranslationService;
  logger: Logger;
}

export interface OrderItemResponse {
  orderItem: OrderItem;
  message: string;
}
