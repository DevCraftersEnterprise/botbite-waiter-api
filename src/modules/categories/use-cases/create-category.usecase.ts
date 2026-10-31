import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TranslationService } from '@/common/services/translation.service';
import { errorCode } from '@/common/utils/error.util';
import { CreateCategoryDto } from '@/modules/categories/dto/create-category.dto';
import { Category } from '@/modules/categories/entities/category.entity';
import { CategoryResponse } from '@/modules/categories/interfaces/categories.interfaces';

const UNIQUE_VIOLATION = '23505';

@Injectable()
export class CreateCategoryUseCase {
  private readonly logger = new Logger(CreateCategoryUseCase.name);

  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    private readonly translationService: TranslationService,
  ) {}

  async execute(
    createCategoryDto: CreateCategoryDto,
    lang: string,
  ): Promise<CategoryResponse> {
    const category = this.categoryRepository.create(createCategoryDto);

    try {
      await this.categoryRepository.save(category);
    } catch (error) {
      if (errorCode(error) === UNIQUE_VIOLATION) {
        throw new ConflictException('The restaurant already has this category');
      }
      throw error;
    }

    this.logger.log(`Category created: ${category.name}`);

    return {
      category,
      message: this.translationService.translate(
        'categories.category_created',
        lang,
      ),
    };
  }
}
