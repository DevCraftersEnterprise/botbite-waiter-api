import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TranslationService } from '@/common/services/translation.service';
import { Menu } from '@/modules/menus/entities/menu.entity';
import { MenuResponse } from '@/modules/menus/interfaces/menus.interfaces';

@Injectable()
export class FindOneMenuUseCase {
  private readonly logger = new Logger(FindOneMenuUseCase.name);

  constructor(
    @InjectRepository(Menu)
    private readonly menuRepository: Repository<Menu>,
    private readonly translationService: TranslationService,
  ) {}

  async execute(menuId: string, lang: string): Promise<MenuResponse> {
    const menu = await this.menuRepository.findOne({
      where: { id: menuId },
      relations: { menuItems: true },
    });

    if (!menu) {
      this.logger.warn(`Menu not found: ${menuId}`);
      throw new NotFoundException(
        this.translationService.translate('menus.menu_not_found', lang),
      );
    }

    return {
      menu,
      message: this.translationService.translate('menus.menu_found', lang),
    };
  }
}
