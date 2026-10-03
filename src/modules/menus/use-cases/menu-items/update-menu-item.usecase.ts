import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TranslationService } from '@/common/services/translation.service';
import { UpdateMenuItemDto } from '@/modules/menus/dto/update-menu-item.dto';
import { MenuItem } from '@/modules/menus/entities/menu-item.entity';
import { MenuItemResponse } from '@/modules/menus/interfaces/menu-items.interfaces';
import { FindOneMenuItemUseCase } from '@/modules/menus/use-cases/menu-items/find-one-menu-item.usecase';

@Injectable()
export class UpdateMenuItemUseCase {
  private readonly logger = new Logger(UpdateMenuItemUseCase.name);

  constructor(
    @InjectRepository(MenuItem)
    private readonly menuItemRepository: Repository<MenuItem>,
    private readonly translationService: TranslationService,
    private readonly findOneMenuItemUseCase: FindOneMenuItemUseCase,
  ) {}

  async execute(
    menuId: string,
    itemId: string,
    updateMenuItemDto: UpdateMenuItemDto,
    lang: string,
  ): Promise<MenuItemResponse> {
    const { menuItem } = await this.findOneMenuItemUseCase.execute(
      menuId,
      itemId,
      lang,
    );

    Object.assign(menuItem, updateMenuItemDto);
    await this.menuItemRepository.save(menuItem);

    this.logger.log(`Menu item updated: ${menuItem.id} in menu: ${menuId}`);

    return {
      menuItem,
      message: this.translationService.translate(
        'menus.menuitem_updated',
        lang,
      ),
    };
  }
}
