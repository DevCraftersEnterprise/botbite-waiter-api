import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Lang } from '@/common/decorators/lang.decorator';
import {
  assertFileContent,
  uploadOptions,
} from '@/common/uploads/upload-options';
import { AccessControlService } from '@/core/access/access-control.service';
import { Auth } from '@/core/auth/decorators/auth.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import { UserRoles } from '@/core/auth/enums/user-roles.enum';
import { ExportMenuUseCase } from '@/modules/menus/use-cases/menu-csv/export-menu.usecase';
import { ImportMenuUseCase } from '@/modules/menus/use-cases/menu-csv/import-menu.usecase';
import { PreviewMenuImportUseCase } from '@/modules/menus/use-cases/menu-csv/preview-menu-import.usecase';
import { User } from '@/modules/users/entities/user.entity';

const MENU_ROLES = [UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT];

/**
 * El menú de una sucursal por CSV. No usa CatalogChangedInterceptor: la vista
 * previa no cambia nada, y la importación avisa al bot una sola vez al final.
 */
@Controller('menus/menu/:menuId')
export class MenuCsvController {
  constructor(
    private readonly accessControl: AccessControlService,
    private readonly previewMenuImport: PreviewMenuImportUseCase,
    private readonly importMenu: ImportMenuUseCase,
    private readonly exportMenu: ExportMenuUseCase,
  ) {}

  @Post('import/preview')
  @HttpCode(200)
  @Auth(MENU_ROLES)
  @UseInterceptors(FileInterceptor('file', uploadOptions('csv')))
  async preview(
    @Param('menuId', ParseUUIDPipe) menuId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
    @Lang() lang: string,
  ) {
    await this.accessControl.assertMenuAccess(user, menuId);
    return this.previewMenuImport.execute(
      menuId,
      assertFileContent(file, 'csv').buffer,
      lang,
    );
  }

  @Post('import')
  @Auth(MENU_ROLES)
  @UseInterceptors(FileInterceptor('file', uploadOptions('csv')))
  async import(
    @Param('menuId', ParseUUIDPipe) menuId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
    @Lang() lang: string,
  ) {
    await this.accessControl.assertMenuAccess(user, menuId);
    return this.importMenu.execute(
      menuId,
      assertFileContent(file, 'csv').buffer,
      lang,
    );
  }

  @Get('export')
  @Auth(MENU_ROLES)
  async export(
    @Param('menuId', ParseUUIDPipe) menuId: string,
    @CurrentUser() user: User,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.accessControl.assertMenuAccess(user, menuId);
    const { fileName, content } = await this.exportMenu.execute(menuId);

    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    });
    return new StreamableFile(Buffer.from(content, 'utf8'));
  }
}
