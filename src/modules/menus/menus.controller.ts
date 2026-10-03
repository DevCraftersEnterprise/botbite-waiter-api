import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Lang } from '@/common/decorators/lang.decorator';
import {
  assertFileContent,
  uploadOptions,
} from '@/common/uploads/upload-options';
import { AccessControlService } from '@/core/access/access-control.service';
import { Auth } from '@/core/auth/decorators/auth.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import { UserRoles } from '@/core/auth/enums/user-roles.enum';
import { CreateMenuItemDto } from '@/modules/menus/dto/create-menu-item.dto';
import { CreateMenuDto } from '@/modules/menus/dto/create-menu.dto';
import { FindMenuItemDto } from '@/modules/menus/dto/find-menu-item.dto';
import { FindMenuDto } from '@/modules/menus/dto/find-menu.dto';
import { UpdateMenuItemDto } from '@/modules/menus/dto/update-menu-item.dto';
import { UpdateMenuDto } from '@/modules/menus/dto/update-menu.dto';
import { MenusService } from '@/modules/menus/menus.service';
import { User } from '@/modules/users/entities/user.entity';

const MENU_ROLES = [UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT];

@Controller('menus')
export class MenusController {
  constructor(
    private readonly menusService: MenusService,
    private readonly accessControl: AccessControlService,
  ) {}

  //#region Menu
  @Post(':branchId')
  @Auth(MENU_ROLES)
  async createMenu(
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: CreateMenuDto,
    @CurrentUser() user: User,
    @Lang() lang: string,
  ) {
    await this.accessControl.assertBranchAccess(user, branchId);
    return this.menusService.createMenu(branchId, dto, lang);
  }

  @Get(':branchId')
  @Auth(MENU_ROLES)
  async findMenusByBranch(
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Query() findMenuDto: FindMenuDto,
    @CurrentUser() user: User,
    @Lang() lang: string,
  ) {
    await this.accessControl.assertBranchAccess(user, branchId);
    const { limit, offset, ...searchFilters } = findMenuDto;
    return this.menusService.findMenusByBranch(
      branchId,
      { limit, offset },
      searchFilters,
      lang,
    );
  }

  @Get('menu/:menuId')
  @Auth(MENU_ROLES)
  async findOneMenu(
    @Param('menuId', ParseUUIDPipe) menuId: string,
    @CurrentUser() user: User,
    @Lang() lang: string,
  ) {
    await this.accessControl.assertMenuAccess(user, menuId);
    return this.menusService.findOneMenu(menuId, lang);
  }

  @Post('menu/upload-file/:menuId')
  @Auth(MENU_ROLES)
  @UseInterceptors(FileInterceptor('file', uploadOptions('pdf')))
  async uploadMenuFile(
    @Param('menuId', ParseUUIDPipe) menuId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
    @Lang() lang: string,
  ) {
    await this.accessControl.assertMenuAccess(user, menuId);
    return this.menusService.uploadMenuFile(
      menuId,
      assertFileContent(file, 'pdf'),
      lang,
    );
  }

  @Patch('menu/:menuId')
  @Auth(MENU_ROLES)
  async updateMenu(
    @Param('menuId', ParseUUIDPipe) menuId: string,
    @Body() dto: UpdateMenuDto,
    @CurrentUser() user: User,
    @Lang() lang: string,
  ) {
    await this.accessControl.assertMenuAccess(user, menuId);
    return this.menusService.updateMenu(menuId, dto, lang);
  }

  @Delete('menu/:menuId')
  @Auth(MENU_ROLES)
  async removeMenu(
    @Param('menuId', ParseUUIDPipe) menuId: string,
    @CurrentUser() user: User,
    @Lang() lang: string,
  ) {
    await this.accessControl.assertMenuAccess(user, menuId);
    return this.menusService.removeMenu(menuId, lang);
  }
  //#endregion

  //#region MenuItem
  @Post('menu/:menuId/items')
  @Auth(MENU_ROLES)
  async createMenuItem(
    @Param('menuId', ParseUUIDPipe) menuId: string,
    @Body() dto: CreateMenuItemDto,
    @CurrentUser() user: User,
    @Lang() lang: string,
  ) {
    await this.accessControl.assertMenuAccess(user, menuId);
    await this.accessControl.assertProductBelongsToMenuRestaurant(
      menuId,
      dto.productId,
    );
    return this.menusService.createMenuItem(menuId, dto, lang);
  }

  @Get('menu/:menuId/items')
  @Auth(MENU_ROLES)
  async findMenuItems(
    @Param('menuId', ParseUUIDPipe) menuId: string,
    @Query() findMenuItemDto: FindMenuItemDto,
    @CurrentUser() user: User,
    @Lang() lang: string,
  ) {
    await this.accessControl.assertMenuAccess(user, menuId);
    const { limit, offset, ...searchFilters } = findMenuItemDto;
    return this.menusService.findMenuItems(
      menuId,
      { limit, offset },
      searchFilters,
      lang,
    );
  }

  @Get('menu/:menuId/items/:itemId')
  @Auth(MENU_ROLES)
  async findOneMenuItem(
    @Param('menuId', ParseUUIDPipe) menuId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @CurrentUser() user: User,
    @Lang() lang: string,
  ) {
    await this.accessControl.assertMenuAccess(user, menuId);
    return this.menusService.findOneMenuItem(menuId, itemId, lang);
  }

  @Patch('menu/:menuId/items/:itemId')
  @Auth(MENU_ROLES)
  async updateMenuItem(
    @Param('menuId', ParseUUIDPipe) menuId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateMenuItemDto,
    @CurrentUser() user: User,
    @Lang() lang: string,
  ) {
    await this.accessControl.assertMenuAccess(user, menuId);
    if (dto.productId) {
      await this.accessControl.assertProductBelongsToMenuRestaurant(
        menuId,
        dto.productId,
      );
    }
    return this.menusService.updateMenuItem(menuId, itemId, dto, lang);
  }

  @Delete('menu/:menuId/items/:itemId')
  @Auth(MENU_ROLES)
  async removeMenuItem(
    @Param('menuId', ParseUUIDPipe) menuId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @CurrentUser() user: User,
    @Lang() lang: string,
  ) {
    await this.accessControl.assertMenuAccess(user, menuId);
    return this.menusService.removeMenuItem(menuId, itemId, lang);
  }
  //#endregion
}
