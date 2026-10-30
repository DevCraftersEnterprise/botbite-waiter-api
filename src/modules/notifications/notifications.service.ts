import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CashierNotification } from '@/modules/notifications/entities/cashier-notifications.entity';
import { OrdersGateway } from '@/modules/notifications/gateways/orders.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(CashierNotification)
    private readonly cashierNotificationRepository: Repository<CashierNotification>,
    private readonly ordersGateway: OrdersGateway,
  ) {}

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
        take: 10,
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
    const updated = await this.cashierNotificationRepository.save(notification);

    if (notification.branchId) {
      this.ordersGateway.emitNotificationUpdate(notification.branchId, updated);
    }
  }
}
