import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BotAdminController } from '@/modules/bot/bot-admin.controller';
import { BotController } from '@/modules/bot/bot.controller';
import { BotApiKey } from '@/modules/bot/entities/bot-api-key.entity';
import { BotKeyGuard } from '@/modules/bot/guards/bot-key.guard';
import { BotConfigService } from '@/modules/bot/services/bot-config.service';
import { BotKeysService } from '@/modules/bot/services/bot-keys.service';
import { Branch } from '@/modules/branches/entities/branch.entity';
import { Menu } from '@/modules/menus/entities/menu.entity';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { Order } from '@/modules/orders/entities/order.entity';
import { OrdersModule } from '@/modules/orders/orders.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BotApiKey, Branch, Menu, Order]),
    OrdersModule,
    NotificationsModule,
  ],
  controllers: [BotController, BotAdminController],
  providers: [BotKeysService, BotConfigService, BotKeyGuard],
})
export class BotModule {}
