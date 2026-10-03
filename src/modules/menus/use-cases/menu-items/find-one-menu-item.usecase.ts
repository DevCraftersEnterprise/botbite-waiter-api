import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MenuItemResponse } from '@/modules/menus/interfaces/menu-items.interfaces';
import { FindOneMenuUseCase } from '@/modules/menus/use-cases/menus/find-one-menu.usecase';
import { MenuItem } from '@/modules/menus/entities/menu-item.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { TranslationService } from '@/common/services/translation.service';

@Injectable()
export class FindOneMenuItemUseCase {
  private readonly logger = new Logger(FindOneMenuItemUseCase.name);

  constructor(
    @InjectRepository(MenuItem)
    private readonly menuItemRepository: Repository<MenuItem>,
    private readonly translationService: TranslationService,
    private readonly findOneMenuUseCase: FindOneMenuUseCase,
  ) {}

  async execute(
    menuId: string,
    itemId: string,
    lang: string,
  ): Promise<MenuItemResponse> {
    await this.findOneMenuUseCase.execute(menuId, lang);

    const menuItem = await this.menuItemRepository.findOne({
      where: { id: itemId, menuId },
    });

    if (!menuItem) {
      this.logger.warn(`Menu item not found: ${itemId} in menu: ${menuId}`);
      throw new NotFoundException(
        this.translationService.translate('menus.menuitem_not_found', lang),
      );
    }

    return {
      menuItem,
      message: this.translationService.translate('menus.menuitem_found', lang),
    };
  }
}
