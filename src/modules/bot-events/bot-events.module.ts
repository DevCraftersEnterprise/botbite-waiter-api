import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BotEventsService } from '@/modules/bot-events/bot-events.service';
import { CatalogChangedInterceptor } from '@/modules/bot-events/catalog-changed.interceptor';
import { Branch } from '@/modules/branches/entities/branch.entity';
import { Category } from '@/modules/categories/entities/category.entity';
import { Menu } from '@/modules/menus/entities/menu.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Branch, Category, Menu])],
  providers: [BotEventsService, CatalogChangedInterceptor],
  exports: [BotEventsService, CatalogChangedInterceptor],
})
export class BotEventsModule {}
