import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TranslationService } from '@/common/services/translation.service';
import { Category } from '@/modules/categories/entities/category.entity';
import { CategoryResponse } from '@/modules/categories/interfaces/categories.interfaces';

@Injectable()
export class FindOneCategoryUseCase {
  private readonly logger = new Logger(FindOneCategoryUseCase.name);

  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    private readonly translationService: TranslationService,
  ) {}

  async execute(id: number, lang: string): Promise<CategoryResponse> {
    const category = await this.categoryRepository.findOne({ where: { id } });

    if (!category) {
      this.logger.warn(`Category not found: ${id}`);
      throw new NotFoundException(
        this.translationService.translate('errors.category_not_found', lang),
      );
    }

    return {
      category,
      message: this.translationService.translate(
        'categories.category_found',
        lang,
      ),
    };
  }
}
