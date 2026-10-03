import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TranslationService } from '@/common/services/translation.service';
import { CreateOrderItemDto } from '@/modules/orders/dto/create-order-item.dto';
import { CreateOrderDto } from '@/modules/orders/dto/create-order.dto';
import { UpdateOrderDto } from '@/modules/orders/dto/update-order.dto';
import { OrderItem } from '@/modules/orders/entities/order-item.entity';
import { Order } from '@/modules/orders/entities/order.entity';
import { findAllOrdersUseCase } from '@/modules/orders/use-cases/orders/find-all-orders.use-case';
import { findOneOrderUseCase } from '@/modules/orders/use-cases/orders/find-one-order.use-case';
import { updateOrderUseCase } from '@/modules/orders/use-cases/orders/update-order.use-case';
import { createOrderItemUseCase } from '@/modules/orders/use-cases/order-items/create-order-item.use-case';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    private readonly translationService: TranslationService,
  ) {}

  async createOrder(createOrderDto: CreateOrderDto, lang: string) {
    // En v1 los orderItems del body se ignoraban (la relación no tiene
    // cascade); ahora se guardan junto con el pedido.
    const order = await this.createOrderWithItems({
      branchId: createOrderDto.branchId,
      customerId: createOrderDto.customerId,
      items: createOrderDto.orderItems.map((item) => ({
        ...item,
        quantity: 1,
      })),
    });

    return {
      order,
      message: this.translationService.translate('orders.order_created', lang),
    };
  }

  async findAllOrders(branchId: string, lang: string) {
    return findAllOrdersUseCase({
      branchId,
      lang,
      repository: this.orderRepository,
      translationService: this.translationService,
    });
  }

  async findOneOrder(id: string, lang: string) {
    return findOneOrderUseCase({
      orderId: id,
      lang,
      repository: this.orderRepository,
      logger: this.logger,
      translationService: this.translationService,
    });
  }

  async updateOrder(id: string, dto: UpdateOrderDto, lang: string) {
    return updateOrderUseCase({
      dto,
      lang,
      orderId: id,
      repository: this.orderRepository,
      logger: this.logger,
      translationService: this.translationService,
    });
  }

  /**
   * Crea un pedido con todos sus items y el total en una sola transacción
   * (lo usa el bot al cerrar la cuenta). En v1 se hacían 1 + N + 1 consultas
   * sueltas, una por cada unidad, y un fallo a medias dejaba pedidos
   * incompletos.
   */
  async createOrderWithItems(params: {
    branchId: string;
    customerId: string;
    items: Array<{
      menuItemId: string;
      price: number;
      quantity: number;
      notes?: string;
    }>;
  }): Promise<Order> {
    const { branchId, customerId, items } = params;

    const total = items.reduce(
      (acc, item) => acc + item.price * item.quantity,
      0,
    );

    return this.orderRepository.manager.transaction(async (manager) => {
      const order = await manager.save(
        manager.create(Order, { branchId, customerId, total }),
      );

      const orderItems = items.flatMap((item) =>
        Array.from({ length: item.quantity }, () =>
          manager.create(OrderItem, {
            orderId: order.id,
            menuItemId: item.menuItemId,
            price: item.price,
            notes: item.notes,
          }),
        ),
      );

      if (orderItems.length > 0) await manager.save(orderItems);

      this.logger.log(
        `Order ${order.id} created with ${orderItems.length} items. Total: $${total.toFixed(2)}`,
      );

      return order;
    });
  }

  async addOrderItem(orderId: string, dto: CreateOrderItemDto, lang: string) {
    return createOrderItemUseCase({
      dto,
      lang,
      orderId,
      orderRepository: this.orderRepository,
      orderItemRepository: this.orderItemRepository,
      translationService: this.translationService,
      logger: this.logger,
    });
  }
}
