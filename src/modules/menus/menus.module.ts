import { Module } from '@nestjs/common';
import { MenusService } from '@/modules/menus/menus.service';
import { MenusController } from '@/modules/menus/menus.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Menu } from '@/modules/menus/entities/menu.entity';
import { MenuItem } from '@/modules/menus/entities/menu-item.entity';
import { CommonModule } from '@/common/common.module';
import { BranchesModule } from '@/modules/branches/branches.module';
import { CreateMenuUseCase } from '@/modules/menus/use-cases/menus/create-menu.usecase';
import { FindMenusByBranchUseCase } from '@/modules/menus/use-cases/menus/find-menus-by-branch.usecase';
import { FindOneMenuUseCase } from '@/modules/menus/use-cases/menus/find-one-menu.usecase';
import { UploadMenuFileUseCase } from '@/modules/menus/use-cases/menus/upload-menu-file.usecase';
import { UpdateMenuUseCase } from '@/modules/menus/use-cases/menus/update-menu.usecase';
import { RemoveMenuUseCase } from '@/modules/menus/use-cases/menus/remove-menu.usecase';
import { CreateMenuItemUseCase } from '@/modules/menus/use-cases/menu-items/create-menu-item.usecase';
import { FindMenuItemsUseCase } from '@/modules/menus/use-cases/menu-items/find-menu-items.usecase';
import { FindOneMenuItemUseCase } from '@/modules/menus/use-cases/menu-items/find-one-menu-item.usecase';
import { UpdateMenuItemUseCase } from '@/modules/menus/use-cases/menu-items/update-menu-item.usecase';
import { RemoveMenuItemUseCase } from '@/modules/menus/use-cases/menu-items/remove-menu-item.usecase';

@Module({
  controllers: [MenusController],
  providers: [
    MenusService,
    CreateMenuUseCase,
    FindMenusByBranchUseCase,
    FindOneMenuUseCase,
    UploadMenuFileUseCase,
    UpdateMenuUseCase,
    RemoveMenuUseCase,
    CreateMenuItemUseCase,
    FindMenuItemsUseCase,
    FindOneMenuItemUseCase,
    UpdateMenuItemUseCase,
    RemoveMenuItemUseCase,
  ],
  imports: [
    TypeOrmModule.forFeature([Menu, MenuItem]),
    CommonModule,

    BranchesModule,
  ],
  exports: [TypeOrmModule, MenusService],
})
export class MenusModule {}
