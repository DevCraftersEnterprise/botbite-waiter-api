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
import { MenuCsvController } from '@/modules/menus/menu-csv.controller';
import { MenuPhotoService } from '@/modules/menus/csv/menu-photo.service';
import { PlanMenuImportUseCase } from '@/modules/menus/use-cases/menu-csv/plan-menu-import.usecase';
import { PreviewMenuImportUseCase } from '@/modules/menus/use-cases/menu-csv/preview-menu-import.usecase';
import { ImportMenuUseCase } from '@/modules/menus/use-cases/menu-csv/import-menu.usecase';
import { ExportMenuUseCase } from '@/modules/menus/use-cases/menu-csv/export-menu.usecase';

@Module({
  controllers: [MenusController, MenuCsvController],
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
    MenuPhotoService,
    PlanMenuImportUseCase,
    PreviewMenuImportUseCase,
    ImportMenuUseCase,
    ExportMenuUseCase,
  ],
  imports: [
    TypeOrmModule.forFeature([Menu, MenuItem]),
    CommonModule,

    BranchesModule,
  ],
  exports: [TypeOrmModule, MenusService],
})
export class MenusModule {}
