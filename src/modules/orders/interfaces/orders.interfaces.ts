import { TranslationService } from '@/common/services/translation.service';
import { Repository } from 'typeorm';
import { CreateOrderDto } from '@/modules/orders/dto/create-order.dto';
import { Order } from '@/modules/orders/entities/order.entity';
import { Logger } from '@nestjs/common';
import { UpdateOrderDto } from '@/modules/orders/dto/update-order.dto';

export interface CreateOrder {
  dto: CreateOrderDto;
  lang: string;
  repository: Repository<Order>;
  logger: Logger;
  translationService: TranslationService;
}
export interface UpdateOrder {
  dto: UpdateOrderDto;
  lang: string;
  orderId: string;
  repository: Repository<Order>;
  logger: Logger;
  translationService: TranslationService;
}

export interface FindOrders {
  branchId: string;
  lang: string;
  repository: Repository<Order>;
  translationService: TranslationService;
}

export interface FindOrder {
  orderId: string;
  lang: string;
  repository: Repository<Order>;
  logger: Logger;
  translationService: TranslationService;
}

export interface OrderResponse {
  order: Order;
  message: string;
}

export interface OrdersResponse {
  orders: Order[];
  message: string;
}
