import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TranslationService } from '@/common/services/translation.service';
import {
  cloudinaryFolder,
  uploadPdfToCloudinary,
} from '@/common/utils/upload-to-cloudinary';
import { Menu } from '@/modules/menus/entities/menu.entity';
import { MenuResponse } from '@/modules/menus/interfaces/menus.interfaces';
import { FindOneMenuUseCase } from '@/modules/menus/use-cases/menus/find-one-menu.usecase';

@Injectable()
export class UploadMenuFileUseCase {
  private readonly logger = new Logger(UploadMenuFileUseCase.name);

  constructor(
    @InjectRepository(Menu)
    private readonly menuRepository: Repository<Menu>,
    private readonly translationService: TranslationService,
    private readonly findOneMenuUseCase: FindOneMenuUseCase,
  ) {}

  async execute(
    menuId: string,
    file: Express.Multer.File,
    lang: string,
  ): Promise<MenuResponse> {
    const { menu } = await this.findOneMenuUseCase.execute(menuId, lang);

    const folder = cloudinaryFolder('menus');

    const menuUrl = await uploadPdfToCloudinary(
      file.buffer,
      folder,
      `menu-${menuId}`,
    );

    menu.pdfLink = menuUrl;
    await this.menuRepository.save(menu);

    this.logger.log(`Menu file uploaded for menu ${menuId}`);

    return {
      menu,
      message: this.translationService.translate(
        'menus.menu_file_uploaded',
        lang,
      ),
    };
  }
}
