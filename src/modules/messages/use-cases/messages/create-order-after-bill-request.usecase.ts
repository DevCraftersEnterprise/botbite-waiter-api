import { Injectable, Logger } from '@nestjs/common';
import { Branch } from '@/modules/branches/entities/branch.entity';
import { Order } from '@/modules/orders/entities/order.entity';
import { OrdersService } from '@/modules/orders/orders.service';

type OrderItems = Record<
  string,
  { price: number; quantity: number; menuItemId: string; notes?: string }
>;

@Injectable()
export class CreateOrderAfterBillRequestUseCase {
  private readonly logger = new Logger(CreateOrderAfterBillRequestUseCase.name);

  constructor(private readonly ordersService: OrdersService) {}

  /**
   * Guarda en base de datos el pedido confirmado cuando el cliente pide la
   * cuenta. Busca los items en TODOS los menús de la sucursal (v1 solo miraba
   * el primero y perdía los productos de los demás).
   */
  async execute(
    customerId: string,
    orderItems: OrderItems,
    branch: Branch,
  ): Promise<Order | undefined> {
    const entries = Object.entries(orderItems ?? {});

    if (entries.length === 0) {
      this.logger.warn('No confirmed items to save for this bill request');
      return;
    }

    const knownMenuItemIds = new Set(
      (branch.menus ?? []).flatMap((menu) =>
        (menu.menuItems ?? []).map((item) => item.id),
      ),
    );

    const items = entries
      .filter(([productKey, item]) => {
        const known =
          !!item.menuItemId && knownMenuItemIds.has(item.menuItemId);
        if (!known)
          this.logger.warn(
            `Menu item not found for "${productKey.split('||')[0]}". Skipping.`,
          );
        return known && item.quantity > 0;
      })
      .map(([, item]) => ({
        menuItemId: item.menuItemId,
        price: Number(item.price),
        quantity: item.quantity,
        notes: item.notes,
      }));

    if (items.length === 0) return;

    return this.ordersService.createOrderWithItems({
      branchId: branch.id,
      customerId,
      items,
    });
  }
}
