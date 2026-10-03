import { Module } from '@nestjs/common';
import { OrdersService } from '@/modules/orders/orders.service';
import { OrdersController } from '@/modules/orders/orders.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '@/modules/orders/entities/order.entity';
import { OrderItem } from '@/modules/orders/entities/order-item.entity';
import { CommonModule } from '@/common/common.module';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService],
  imports: [TypeOrmModule.forFeature([Order, OrderItem]), CommonModule],
  exports: [TypeOrmModule, OrdersService],
})
export class OrdersModule {}
