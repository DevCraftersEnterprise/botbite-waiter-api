import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from '@/common/common.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { OrderItem } from '@/modules/orders/entities/order-item.entity';
import { OrderRound } from '@/modules/orders/entities/order-round.entity';
import { Order } from '@/modules/orders/entities/order.entity';
import { OrdersController } from '@/modules/orders/orders.controller';
import { OrdersService } from '@/modules/orders/orders.service';
import { OrderAccountsService } from '@/modules/orders/services/order-accounts.service';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, OrderAccountsService],
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, OrderRound]),
    CommonModule,
    NotificationsModule,
  ],
  exports: [TypeOrmModule, OrdersService, OrderAccountsService],
})
export class OrdersModule {}
