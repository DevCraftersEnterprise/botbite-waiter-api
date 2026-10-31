import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TranslationService } from '@/common/services/translation.service';
import { errorCode } from '@/common/utils/error.util';
import { UpdateCategoryDto } from '@/modules/categories/dto/update-category.dto';
import { Category } from '@/modules/categories/entities/category.entity';
import { CategoryResponse } from '@/modules/categories/interfaces/categories.interfaces';
import { FindOneCategoryUseCase } from '@/modules/categories/use-cases/find-one-category.usecase';

const UNIQUE_VIOLATION = '23505';

@Injectable()
export class UpdateCategoryUseCase {
  private readonly logger = new Logger(UpdateCategoryUseCase.name);

  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    private readonly translationService: TranslationService,
    private readonly findOneCategoryUseCase: FindOneCategoryUseCase,
  ) {}

  async execute(
    id: number,
    updateCategoryDto: UpdateCategoryDto,
    lang: string,
  ): Promise<CategoryResponse> {
    const { category } = await this.findOneCategoryUseCase.execute(id, lang);

    Object.assign(category, updateCategoryDto);
    try {
      await this.categoryRepository.save(category);
    } catch (error) {
      if (errorCode(error) === UNIQUE_VIOLATION) {
        throw new ConflictException('The restaurant already has this category');
      }
      throw error;
    }

    this.logger.log(`Category updated: ${category.name}`);

    return {
      category,
      message: this.translationService.translate(
        'categories.category_updated',
        lang,
      ),
    };
  }
}
