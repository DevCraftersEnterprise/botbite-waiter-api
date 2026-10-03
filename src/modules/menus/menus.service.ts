import { Injectable } from '@nestjs/common';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { CreateMenuItemDto } from '@/modules/menus/dto/create-menu-item.dto';
import { CreateMenuDto } from '@/modules/menus/dto/create-menu.dto';
import { FindMenuItemDto } from '@/modules/menus/dto/find-menu-item.dto';
import { FindMenuDto } from '@/modules/menus/dto/find-menu.dto';
import { UpdateMenuItemDto } from '@/modules/menus/dto/update-menu-item.dto';
import { UpdateMenuDto } from '@/modules/menus/dto/update-menu.dto';
import {
  MenuItemResponse,
  MenuItemsListResponse,
} from '@/modules/menus/interfaces/menu-items.interfaces';
import {
  MenuListResponse,
  MenuResponse,
} from '@/modules/menus/interfaces/menus.interfaces';
import { CreateMenuItemUseCase } from '@/modules/menus/use-cases/menu-items/create-menu-item.usecase';
import { FindMenuItemsUseCase } from '@/modules/menus/use-cases/menu-items/find-menu-items.usecase';
import { FindOneMenuItemUseCase } from '@/modules/menus/use-cases/menu-items/find-one-menu-item.usecase';
import { RemoveMenuItemUseCase } from '@/modules/menus/use-cases/menu-items/remove-menu-item.usecase';
import { UpdateMenuItemUseCase } from '@/modules/menus/use-cases/menu-items/update-menu-item.usecase';
import { CreateMenuUseCase } from '@/modules/menus/use-cases/menus/create-menu.usecase';
import { FindMenusByBranchUseCase } from '@/modules/menus/use-cases/menus/find-menus-by-branch.usecase';
import { FindOneMenuUseCase } from '@/modules/menus/use-cases/menus/find-one-menu.usecase';
import { RemoveMenuUseCase } from '@/modules/menus/use-cases/menus/remove-menu.usecase';
import { UpdateMenuUseCase } from '@/modules/menus/use-cases/menus/update-menu.usecase';
import { UploadMenuFileUseCase } from '@/modules/menus/use-cases/menus/upload-menu-file.usecase';

@Injectable()
export class MenusService {
  constructor(
    // Menu use cases
    private readonly createMenuUseCase: CreateMenuUseCase,
    private readonly findMenusByBranchUseCase: FindMenusByBranchUseCase,
    private readonly findOneMenuUseCase: FindOneMenuUseCase,
    private readonly uploadMenuFileUseCase: UploadMenuFileUseCase,
    private readonly updateMenuUseCase: UpdateMenuUseCase,
    private readonly removeMenuUseCase: RemoveMenuUseCase,
    // MenuItem use cases
    private readonly createMenuItemUseCase: CreateMenuItemUseCase,
    private readonly findMenuItemsUseCase: FindMenuItemsUseCase,
    private readonly findOneMenuItemUseCase: FindOneMenuItemUseCase,
    private readonly updateMenuItemUseCase: UpdateMenuItemUseCase,
    private readonly removeMenuItemUseCase: RemoveMenuItemUseCase,
  ) {}

  //#region Menu
  async createMenu(
    branchId: string,
    createMenuDto: CreateMenuDto,
    lang: string,
  ): Promise<MenuResponse> {
    return await this.createMenuUseCase.execute(branchId, createMenuDto, lang);
  }

  async findMenusByBranch(
    branchId: string,
    paginationDto: PaginationDto = {},
    findMenuDto: FindMenuDto = {},
    lang: string,
  ): Promise<MenuListResponse> {
    return this.findMenusByBranchUseCase.execute(
      branchId,
      paginationDto,
      findMenuDto,
      lang,
    );
  }

  async findOneMenu(menuId: string, lang: string): Promise<MenuResponse> {
    return await this.findOneMenuUseCase.execute(menuId, lang);
  }

  async uploadMenuFile(
    menuId: string,
    file: Express.Multer.File,
    lang: string,
  ): Promise<MenuResponse> {
    return await this.uploadMenuFileUseCase.execute(menuId, file, lang);
  }

  async updateMenu(
    menuId: string,
    dto: UpdateMenuDto,
    lang: string,
  ): Promise<MenuResponse> {
    return await this.updateMenuUseCase.execute(menuId, dto, lang);
  }

  async removeMenu(menuId: string, lang: string): Promise<MenuResponse> {
    return await this.removeMenuUseCase.execute(menuId, lang);
  }
  //#endregion

  //#region MenuItem
  async createMenuItem(
    menuId: string,
    dto: CreateMenuItemDto,
    lang: string,
  ): Promise<MenuItemResponse> {
    return await this.createMenuItemUseCase.execute(menuId, dto, lang);
  }

  async findMenuItems(
    menuId: string,
    paginationDto: PaginationDto = {},
    findMenuItemDto: FindMenuItemDto = {},
    lang: string,
  ): Promise<MenuItemsListResponse> {
    return await this.findMenuItemsUseCase.execute(
      menuId,
      paginationDto,
      findMenuItemDto,
      lang,
    );
  }

  async findOneMenuItem(
    menuId: string,
    itemId: string,
    lang: string,
  ): Promise<MenuItemResponse> {
    return await this.findOneMenuItemUseCase.execute(menuId, itemId, lang);
  }

  async updateMenuItem(
    menuId: string,
    itemId: string,
    dto: UpdateMenuItemDto,
    lang: string,
  ): Promise<MenuItemResponse> {
    return await this.updateMenuItemUseCase.execute(menuId, itemId, dto, lang);
  }

  async removeMenuItem(
    menuId: string,
    itemId: string,
    lang: string,
  ): Promise<MenuItemResponse> {
    return await this.removeMenuItemUseCase.execute(menuId, itemId, lang);
  }
  //#endregion
}
