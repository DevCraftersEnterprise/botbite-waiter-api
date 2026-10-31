import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateCategoryDto } from '@/modules/categories/dto/create-category.dto';

// Una categoría no se puede mover a otro restaurante.
export class UpdateCategoryDto extends PartialType(
  OmitType(CreateCategoryDto, ['restaurantId'] as const),
) {}
