import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
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

/** Los avisos leídos se borran después de estos días. Los pedidos y los pagos se quedan. */
export const READ_NOTIFICATIONS_RETENTION_DAYS = 90;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

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

  /**
   * Borra los avisos leídos de más de 90 días (Carlos, 12 nov 2026). Corre a
   * las 4:00, junto con las otras limpiezas, para no despertar la base otra
   * vez. Los que siguen sin leer se quedan, por viejos que sean.
   */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async deleteOldReadNotifications(): Promise<number> {
    try {
      const result = await this.cashierNotificationRepository
        .createQueryBuilder()
        .delete()
        .from(CashierNotification)
        .where('"isActive" = false')
        .andWhere(
          `COALESCE("readAt", "updatedAt") < now() - make_interval(days => :days)`,
          { days: READ_NOTIFICATIONS_RETENTION_DAYS },
        )
        .execute();
      const deleted = result.affected ?? 0;
      this.logger.log(
        `Deleted ${deleted} read notifications older than ${READ_NOTIFICATIONS_RETENTION_DAYS} days`,
      );
      return deleted;
    } catch (error) {
      this.logger.error('Failed to delete old read notifications', error);
      return 0;
    }
  }
}
