import { NotFoundException } from '@nestjs/common';
import {
  FindOrder,
  OrderResponse,
} from '@/modules/orders/interfaces/orders.interfaces';

export const findOneOrderUseCase = async (
  params: FindOrder,
): Promise<OrderResponse> => {
  const { orderId, lang, repository, logger, translationService } = params;

  const order = await repository.findOne({
    where: { id: orderId },
    relations: { orderItems: true },
  });

  if (!order) {
    logger.warn(`Order not found: ${orderId}`);
    throw new NotFoundException(
      translationService.translate('orders.order_not_found', lang),
    );
  }

  return {
    order,
    message: translationService.translate('orders.order_found', lang),
  };
};
