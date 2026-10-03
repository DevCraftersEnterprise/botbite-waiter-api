import { Injectable, Logger } from '@nestjs/common';
import { MenuItemResponse } from '@/modules/menus/interfaces/menu-items.interfaces';
import { FindOneMenuItemUseCase } from '@/modules/menus/use-cases/menu-items/find-one-menu-item.usecase';
import { MenuItem } from '@/modules/menus/entities/menu-item.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { TranslationService } from '@/common/services/translation.service';

@Injectable()
export class RemoveMenuItemUseCase {
  private readonly logger = new Logger(RemoveMenuItemUseCase.name);

  constructor(
    @InjectRepository(MenuItem)
    private readonly menuItemRepository: Repository<MenuItem>,
    private readonly translationService: TranslationService,
    private readonly findOneMenuItemUseCase: FindOneMenuItemUseCase,
  ) {}

  async execute(
    menuId: string,
    itemId: string,
    lang: string,
  ): Promise<MenuItemResponse> {
    const { menuItem } = await this.findOneMenuItemUseCase.execute(
      menuId,
      itemId,
      lang,
    );

    menuItem.isActive = false;
    await this.menuItemRepository.save(menuItem);

    this.logger.log(`Menu item removed: ${itemId} in menu: ${menuId}`);

    return {
      menuItem,
      message: this.translationService.translate(
        'menus.menuitem_removed',
        lang,
      ),
    };
  }
}
