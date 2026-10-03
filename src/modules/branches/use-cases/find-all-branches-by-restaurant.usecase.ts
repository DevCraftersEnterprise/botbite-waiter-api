import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, In, Repository } from 'typeorm';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { FindBranchDto } from '@/modules/branches/dto/find-branch.dto';
import { Branch } from '@/modules/branches/entities/branch.entity';
import { BranchListResponse } from '@/modules/branches/interfaces/branches.interfaces';

export type BranchListFilters = Omit<FindBranchDto, 'limit' | 'offset'> & {
  /** Si se indica, solo se devuelven estas sucursales (personal asignado). */
  onlyBranchIds?: string[];
};

@Injectable()
export class FindAllBranchesByRestaurantUseCase {
  private readonly logger = new Logger(FindAllBranchesByRestaurantUseCase.name);

  constructor(
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
  ) {}

  async execute(
    restaurantId: string,
    paginationDto: PaginationDto = {},
    findBranchDto: BranchListFilters = {},
  ): Promise<BranchListResponse> {
    const { limit = 10, offset = 0 } = paginationDto;
    const { name, search, isActive, onlyBranchIds } = findBranchDto;

    if (onlyBranchIds?.length === 0) {
      return {
        branches: [],
        total: 0,
        pagination: { limit, offset, totalPages: 0, currentPage: 1 },
      };
    }

    const whereCoindition: FindOptionsWhere<Branch> = {
      restaurant: { id: restaurantId },
    };

    if (onlyBranchIds) whereCoindition.id = In(onlyBranchIds);

    if (name) whereCoindition.name = name;
    if (search) whereCoindition.name = ILike(`%${search}%`);

    if (isActive !== undefined) whereCoindition.isActive = isActive;

    const [branches, total] = await this.branchRepository.findAndCount({
      where: whereCoindition,
      relations: {
        restaurant: { user: true },
        menus: {
          menuItems: { category: true, product: true },
        },
      },
      select: {
        id: true,
        name: true,
        address: true,
        isActive: true,
        phoneNumberAssistant: true,
        phoneNumberReception: true,
        surveyUrl: true,
        qrUrl: true,
        availableMessages: true,
        createdAt: true,
        restaurant: {
          name: true,
          user: { id: true },
        },
        menus: true,
      },
      order: { createdAt: 'DESC' },
      skip: offset,
      take: limit,
    });

    this.logger.debug(
      `Found ${branches.length} branches for restaurant ${restaurantId} with search term "${search}"`,
    );

    return {
      branches,
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
