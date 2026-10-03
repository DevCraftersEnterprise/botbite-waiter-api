import {
  CreateOrderItem,
  OrderItemResponse,
} from '@/modules/orders/interfaces/order-items.interfaces';
import { findOneOrderUseCase } from '@/modules/orders/use-cases/orders/find-one-order.use-case';

export const createOrderItemUseCase = async (
  params: CreateOrderItem,
): Promise<OrderItemResponse> => {
  const {
    dto,
    lang,
    logger,
    orderId,
    orderItemRepository,
    orderRepository,

    translationService,
  } = params;

  const { order } = await findOneOrderUseCase({
    lang,
    logger,
    repository: orderRepository,
    orderId,
    translationService,
  });

  const orderItem = orderItemRepository.create({
    ...dto,
    orderId: order.id,
  });

  await orderItemRepository.save(orderItem);

  logger.log(`Order item created: ${orderItem.id} for order: ${orderId}`);

  return {
    orderItem: orderItem,
    message: translationService.translate('orders.orderitem_created', lang),
  };
};
