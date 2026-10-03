import { NotFoundException } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { Product } from '@/modules/products/entities/product.entity';
import {
  IFindProductParams,
  IProductResponse,
} from '@/modules/products/interfaces/products.interfaces';
import { isUUID } from 'class-validator';

export const findOneProductUseCase = async (
  params: IFindProductParams,
): Promise<IProductResponse> => {
  const { term, restaurantId, repository, logger, lang, translationService } =
    params;

  const whereConditions: FindOptionsWhere<Product>[] = isUUID(term)
    ? [{ id: term, restaurant: { id: restaurantId } }]
    : [{ name: term, restaurant: { id: restaurantId } }];

  const product = await repository.findOne({
    where: whereConditions,
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      imageUrl: true,
      restaurant: {
        name: true,
        user: {
          id: true,
        },
      },
    },
    relations: {
      restaurant: {
        user: true,
      },
    },
  });

  if (!product) {
    logger.warn(`Product not found: ${term} in restaurant: ${restaurantId}`);
    throw new NotFoundException(
      translationService.translate('errors.product_not_found', lang),
    );
  }

  return {
    product,
    message: translationService.translate('products.product_found', lang),
  };
};
