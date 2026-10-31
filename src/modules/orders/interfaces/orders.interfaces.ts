import { TranslationService } from '@/common/services/translation.service';
import { Repository } from 'typeorm';
import { Order } from '@/modules/orders/entities/order.entity';
import { Logger } from '@nestjs/common';

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
