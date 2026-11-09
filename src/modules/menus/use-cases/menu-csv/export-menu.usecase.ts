import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { slugify } from '@/common/utils/slug.util';
import { toMenuCsv } from '@/modules/menus/csv/menu-csv.format';
import { MenuItem } from '@/modules/menus/entities/menu-item.entity';
import { Menu } from '@/modules/menus/entities/menu.entity';

export interface MenuCsvFile {
  fileName: string;
  content: string;
}

/** El menú en el mismo formato que se importa, para editarlo o copiarlo. */
@Injectable()
export class ExportMenuUseCase {
  constructor(
    @InjectRepository(Menu)
    private readonly menuRepository: Repository<Menu>,
    @InjectRepository(MenuItem)
    private readonly menuItemRepository: Repository<MenuItem>,
  ) {}

  async execute(menuId: string): Promise<MenuCsvFile> {
    const menu = await this.menuRepository.findOne({
      where: { id: menuId },
      relations: { branch: true },
    });
    if (!menu) throw new NotFoundException('Menu not found');

    const items = await this.menuItemRepository.find({
      where: { menuId },
      relations: { product: true, category: true },
    });

    const rows = items
      .filter((item) => item.product && item.category)
      .sort(
        (a, b) =>
          a.category.sortOrder - b.category.sortOrder ||
          a.category.name.localeCompare(b.category.name) ||
          a.sortOrder - b.sortOrder ||
          a.product.name.localeCompare(b.product.name),
      )
      .map((item) => ({
        name: item.product.name,
        description: item.product.description,
        category: item.category.name,
        price: Number(item.price),
        family: item.variantGroup,
        recommended: item.shouldRecommend,
        active: item.isActive,
        photoUrl: item.product.imageUrl,
      }));

    const fileName = `${menu.branch.slug}-${slugify(menu.name, 'menu')}.csv`;

    return { fileName, content: toMenuCsv(rows) };
  }
}
