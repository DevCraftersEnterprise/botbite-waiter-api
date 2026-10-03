import { Injectable, Logger } from '@nestjs/common';
import { Branch } from '@/modules/branches/entities/branch.entity';
import { Customer } from '@/modules/customers/entities/customer.entity';
import { SendMessageUseCase } from '@/modules/messages/use-cases/messages/send-message.usecase';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CashierNotification } from '@/modules/messages/entities/cashier-notifications.entity';
import { OrdersGateway } from '@/modules/messages/gateways/orders.gateway';

@Injectable()
export class NotifyCashierAboutInappropriateBehaviorUseCase {
  private readonly logger = new Logger(
    NotifyCashierAboutInappropriateBehaviorUseCase.name,
  );

  constructor(
    @InjectRepository(CashierNotification)
    private readonly cashierNotificationRepository: Repository<CashierNotification>,
    private readonly sendMessageUseCase: SendMessageUseCase,
    private readonly ordersGateway: OrdersGateway,
  ) {}

  async execute(
    from: string,
    message: string,
    location: string,
    branch: Branch,
    customer: Customer,
  ): Promise<void> {
    try {
      const locationInfo = location ? `\nUbicación: ${location}` : '';
      const notificationMessage = `🚨: Comportamiento inapropiado detectado de ${from}: "${message}"
Cliente: ${customer.name}${locationInfo}
Se ha terminado la conversación con el cliente. Por favor, tome las medidas necesarias.
    `;

      if (branch.phoneNumberReception) {
        await this.sendMessageUseCase.execute(
          branch.phoneNumberReception,
          notificationMessage,
          branch.phoneNumberAssistant,
        );
      }

      // TODO: Guardar notificacion
      const notification = await this.cashierNotificationRepository.save({
        branchId: branch.id,
        phoneNumber: customer.phone,
        message: notificationMessage,
      });

      // Emitir evento websocket
      this.ordersGateway.emitNotificationUpdate(branch.id, notification);

      this.logger.warn(
        `Inappropriate behavior detected from ${from}: "${message}"`,
      );
    } catch (error) {
      this.logger.error(
        'Error notifying cashier about inappropriate behavior:',
        error,
      );
    }
  }
}
