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

@Module({
  imports: [TypeOrmModule.forFeature([BotApiKey, Branch, Menu])],
  controllers: [BotController, BotAdminController],
  providers: [BotKeysService, BotConfigService, BotKeyGuard],
})
export class BotModule {}
