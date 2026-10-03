import { Module } from '@nestjs/common';
import { CategoriesService } from '@/modules/categories/categories.service';
import { CategoriesController } from '@/modules/categories/categories.controller';
import { Category } from '@/modules/categories/entities/category.entity';
import { CommonModule } from '@/common/common.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreateCategoryUseCase } from '@/modules/categories/use-cases/create-category.usecase';
import { FindAllCategoriesUseCase } from '@/modules/categories/use-cases/find-all-categories.usecase';
import { FindOneCategoryUseCase } from '@/modules/categories/use-cases/find-one-category.usecase';
import { UpdateCategoryUseCase } from '@/modules/categories/use-cases/update-category.usecase';
import { RemoveCategoryUseCase } from '@/modules/categories/use-cases/remove-category.usecase';

@Module({
  controllers: [CategoriesController],
  providers: [
    CategoriesService,
    CreateCategoryUseCase,
    FindAllCategoriesUseCase,
    FindOneCategoryUseCase,
    UpdateCategoryUseCase,
    RemoveCategoryUseCase,
  ],
  imports: [TypeOrmModule.forFeature([Category]), CommonModule],
  exports: [TypeOrmModule, CategoriesService],
})
export class CategoriesModule {}
