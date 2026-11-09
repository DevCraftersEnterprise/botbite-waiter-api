import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { errorCode } from '@/common/utils/error.util';
import { CashierNotification } from '@/modules/notifications/entities/cashier-notifications.entity';
import { NotificationType } from '@/modules/notifications/enums/notification-type.enum';
import { OrdersGateway } from '@/modules/notifications/gateways/orders.gateway';

const UNIQUE_VIOLATION = '23505';

export interface NewNotification {
  branchId: string;
  type: NotificationType;
  message: string;
  phoneNumber?: string;
  orderId?: string | null;
  roundId?: string | null;
  eventId?: string | null;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(CashierNotification)
    private readonly cashierNotificationRepository: Repository<CashierNotification>,
    private readonly ordersGateway: OrdersGateway,
  ) {}

  /** Guarda el aviso y lo empuja a caja en tiempo real. */
  async create(input: NewNotification): Promise<CashierNotification> {
    const notification = await this.cashierNotificationRepository.save(
      this.cashierNotificationRepository.create(input),
    );

    this.ordersGateway.emitNotificationUpdate(input.branchId, notification);

    return notification;
  }

  /**
   * Como `create`, pero un aviso con el mismo `eventId` en la sucursal no se
   * guarda dos veces: devuelve el que ya existe.
   */
  async createOnce(
    input: NewNotification,
  ): Promise<{ notification: CashierNotification; created: boolean }> {
    const { branchId, eventId } = input;
    const existing = () =>
      this.cashierNotificationRepository.findOne({
        where: { branchId, eventId: eventId ?? undefined },
        withDeleted: true,
      });

    if (eventId) {
      const found = await existing();
      if (found) return { notification: found, created: false };
    }

    try {
      return { notification: await this.create(input), created: true };
    } catch (error) {
      // Dos reintentos a la vez: el índice único deja pasar solo uno.
      if (eventId && errorCode(error) === UNIQUE_VIOLATION) {
        const found = await existing();
        if (found) return { notification: found, created: false };
      }
      throw error;
    }
  }

  markAsRead(notificationId: string): Promise<void> {
    return this.setActive(notificationId, false);
  }

  markAsUnread(notificationId: string): Promise<void> {
    return this.setActive(notificationId, true);
  }

  async findByBranch(branchId: string): Promise<{
    active: CashierNotification[];
    inactive: CashierNotification[];
  }> {
    const [active, inactive] = await Promise.all([
      this.cashierNotificationRepository.find({
        where: { branchId, isActive: true },
        order: { createdAt: 'DESC' },
        take: 50,
      }),
      this.cashierNotificationRepository.find({
        where: { branchId, isActive: false },
        order: { createdAt: 'ASC' },
        take: 10,
      }),
    ]);

    return { active, inactive };
  }

  private async setActive(
    notificationId: string,
    isActive: boolean,
  ): Promise<void> {
    const notification = await this.cashierNotificationRepository.findOne({
      where: { id: notificationId },
      relations: ['customer'],
    });

    if (!notification || notification.isActive === isActive) return;

    notification.isActive = isActive;
    notification.readAt = isActive ? null : new Date();
    const updated = await this.cashierNotificationRepository.save(notification);

    if (notification.branchId) {
      this.ordersGateway.emitNotificationUpdate(notification.branchId, updated);
    }
  }
}
