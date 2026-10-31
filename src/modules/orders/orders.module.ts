import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from '@/common/common.module';
import { CustomersModule } from '@/modules/customers/customers.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { OrderItem } from '@/modules/orders/entities/order-item.entity';
import { OrderRound } from '@/modules/orders/entities/order-round.entity';
import { Order } from '@/modules/orders/entities/order.entity';
import { Payment } from '@/modules/orders/entities/payment.entity';
import { OrdersController } from '@/modules/orders/orders.controller';
import { OrdersService } from '@/modules/orders/orders.service';
import { OrderAccountsService } from '@/modules/orders/services/order-accounts.service';
import { OrderPaymentsService } from '@/modules/orders/services/order-payments.service';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, OrderAccountsService, OrderPaymentsService],
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, OrderRound, Payment]),
    CommonModule,
    CustomersModule,
    NotificationsModule,
  ],
  exports: [
    TypeOrmModule,
    OrdersService,
    OrderAccountsService,
    OrderPaymentsService,
  ],
})
export class OrdersModule {}
