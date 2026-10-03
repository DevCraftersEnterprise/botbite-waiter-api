import {
  FindOrders,
  OrdersResponse,
} from '@/modules/orders/interfaces/orders.interfaces';

export const findAllOrdersUseCase = async (
  params: FindOrders,
): Promise<OrdersResponse> => {
  const { branchId, lang, repository, translationService } = params;

  const where = branchId ? { branchId } : {};

  const orders = await repository.find({
    where,
    relations: { orderItems: true },
  });

  return {
    orders,
    message: translationService.translate('orders.orders_found', lang),
  };
};
