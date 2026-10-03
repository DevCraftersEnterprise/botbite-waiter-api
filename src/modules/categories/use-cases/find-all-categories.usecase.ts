import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { FindCategoryDto } from '@/modules/categories/dto/find-category.dto';
import { Category } from '@/modules/categories/entities/category.entity';
import { CategoryListResponse } from '@/modules/categories/interfaces/categories.interfaces';

@Injectable()
export class FindAllCategoriesUseCase {
  private readonly logger = new Logger(FindAllCategoriesUseCase.name);

  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  async execute(
    paginationDto: PaginationDto = {},
    findCategoryDto: FindCategoryDto = {},
  ): Promise<CategoryListResponse> {
    const { limit = 10, offset = 0 } = paginationDto;
    const { name, search, isActive } = findCategoryDto;

    const whereConditions: FindOptionsWhere<Category> = {};

    if (name) whereConditions.name = ILike(`%${name}%`);
    if (search) whereConditions.name = ILike(`%${search}%`);
    if (isActive !== undefined) whereConditions.isActive = isActive;

    const [categories, total] = await this.categoryRepository.findAndCount({
      where: whereConditions,
      order: { name: 'ASC' },
      skip: offset,
      take: limit,
    });

    this.logger.debug(
      `Found ${categories.length} categories with conditions: ${JSON.stringify(whereConditions)}`,
    );

    return {
      categories,
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
