import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { FindOneBranchUseCase } from '@/modules/branches/use-cases/find-one-branch.usecase';
import { Menu } from '@/modules/menus/entities/menu.entity';
import { MenuListResponse } from '@/modules/menus/interfaces/menus.interfaces';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { FindMenuDto } from '@/modules/menus/dto/find-menu.dto';

@Injectable()
export class FindMenusByBranchUseCase {
  private readonly logger = new Logger(FindMenusByBranchUseCase.name);

  constructor(
    @InjectRepository(Menu)
    private readonly menuRepository: Repository<Menu>,
    private readonly findOneBranchUseCase: FindOneBranchUseCase,
  ) {}

  async execute(
    branchId: string,
    paginationDto: PaginationDto = {},
    findMenuDto: FindMenuDto = {},
    lang: string,
  ): Promise<MenuListResponse> {
    await this.findOneBranchUseCase.execute(branchId, lang);

    const { limit = 10, offset = 0 } = paginationDto;
    const { search, isActive } = findMenuDto;

    const whereConditions: FindOptionsWhere<Menu> = { branchId };

    if (search) whereConditions.name = ILike(`%${search}%`);
    if (isActive !== undefined) whereConditions.isActive = isActive;

    const [menus, total] = await this.menuRepository.findAndCount({
      where: whereConditions,
      relations: { menuItems: true },
      order: { createdAt: 'DESC' },
      skip: offset,
      take: limit,
    });

    this.logger.debug(
      `Found ${menus.length} menus for branch ${branchId} with search="${search}" and isActive=${isActive}`,
    );

    return {
      menus,
      total,
      pagination: {
        limit,
        offset,
        totalPages: Math.ceil(total / limit),
        currentPage: Math.floor(offset / limit) + 1,
      },
    };
  }
}
