import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashierNotification } from '@/modules/notifications/entities/cashier-notifications.entity';
import { OrdersGateway } from '@/modules/notifications/gateways/orders.gateway';
import { LegacyMessagesController } from '@/modules/notifications/legacy-messages.controller';
import { NotificationsController } from '@/modules/notifications/notifications.controller';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { User } from '@/modules/users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CashierNotification, User])],
  controllers: [NotificationsController, LegacyMessagesController],
  providers: [NotificationsService, OrdersGateway],
  exports: [NotificationsService, OrdersGateway],
})
export class NotificationsModule {}
