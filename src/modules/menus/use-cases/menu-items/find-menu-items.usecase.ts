import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { FindMenuItemDto } from '@/modules/menus/dto/find-menu-item.dto';
import { MenuItem } from '@/modules/menus/entities/menu-item.entity';
import { MenuItemsListResponse } from '@/modules/menus/interfaces/menu-items.interfaces';
import { FindOneMenuUseCase } from '@/modules/menus/use-cases/menus/find-one-menu.usecase';

@Injectable()
export class FindMenuItemsUseCase {
  private readonly logger = new Logger(FindMenuItemsUseCase.name);

  constructor(
    @InjectRepository(MenuItem)
    private readonly menuItemRepository: Repository<MenuItem>,
    private readonly findOneMenuUseCase: FindOneMenuUseCase,
  ) {}

  async execute(
    menuId: string,
    paginationDto: PaginationDto = {},
    findMenuItemDto: FindMenuItemDto = {},
    lang: string,
  ): Promise<MenuItemsListResponse> {
    const { menu } = await this.findOneMenuUseCase.execute(menuId, lang);

    const { limit = 10, offset = 0 } = paginationDto;
    const { search, isActive } = findMenuItemDto;

    const queryBuilder = this.menuItemRepository
      .createQueryBuilder('menuItem')
      .leftJoinAndSelect('menuItem.product', 'product')
      .leftJoinAndSelect('menuItem.category', 'category')
      .where('menuItem.menuId = :menuId', { menuId: menu.id });

    if (isActive !== undefined) {
      queryBuilder.andWhere('menuItem.isActive = :isActive', { isActive });
    }

    if (search) {
      queryBuilder.andWhere(
        '(product.name ILIKE :search OR product.normalizedName ILIKE :search)',
        {
          search: `%${search}%`,
        },
      );
    }

    const [items, total] = await queryBuilder
      .orderBy('product.name', 'ASC')
      .addOrderBy('menuItem.createdAt', 'ASC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    this.logger.debug(
      `Found ${items.length} items for menu ${menuId} with search: ${search}, isActive: ${isActive}, offset: ${offset}, limit: ${limit}`,
    );

    return {
      items,
      total,
      pagination: {
        limit,
        offset,
        totalPages: Math.ceil(total / limit),
        currentPage: Math.ceil(offset / limit) + 1,
      },
    };
  }
}
