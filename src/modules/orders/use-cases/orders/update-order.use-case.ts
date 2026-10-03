import {
  OrderResponse,
  UpdateOrder,
} from '@/modules/orders/interfaces/orders.interfaces';
import { findOneOrderUseCase } from '@/modules/orders/use-cases/orders/find-one-order.use-case';

export const updateOrderUseCase = async (
  params: UpdateOrder,
): Promise<OrderResponse> => {
  const { dto, lang, orderId, repository, logger, translationService } = params;

  const { order } = await findOneOrderUseCase({
    orderId,
    lang,
    repository,
    logger,
    translationService,
  });

  Object.assign(order, dto);
  await repository.save(order);

  logger.log(`Order updated: ${order.id}`);
  return {
    order: order,
    message: translationService.translate('orders.order_updated', lang),
  };
};
