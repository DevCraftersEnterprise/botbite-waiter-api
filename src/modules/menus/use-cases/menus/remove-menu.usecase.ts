import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TranslationService } from '@/common/services/translation.service';
import { Menu } from '@/modules/menus/entities/menu.entity';
import { MenuResponse } from '@/modules/menus/interfaces/menus.interfaces';
import { FindOneMenuUseCase } from '@/modules/menus/use-cases/menus/find-one-menu.usecase';

@Injectable()
export class RemoveMenuUseCase {
  private readonly logger = new Logger(RemoveMenuUseCase.name);

  constructor(
    @InjectRepository(Menu)
    private readonly menuRepository: Repository<Menu>,
    private readonly translationService: TranslationService,
    private readonly findOneMenuUseCase: FindOneMenuUseCase,
  ) {}

  async execute(menuId: string, lang: string): Promise<MenuResponse> {
    const { menu } = await this.findOneMenuUseCase.execute(menuId, lang);

    menu.isActive = false;
    await this.menuRepository.save(menu);
    this.logger.log(`Menu removed: ${menu.name} (${menuId})`);

    return {
      menu,
      message: this.translationService.translate('menus.menu_removed', lang),
    };
  }
}
