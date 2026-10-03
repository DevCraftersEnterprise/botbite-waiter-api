import { BadRequestException } from '@nestjs/common';
import {
  IProductResponse,
  IUpdateProductParams,
} from '@/modules/products/interfaces/products.interfaces';
import { findOneProductUseCase } from '@/modules/products/use-cases/find-one-product.use-case';
import { UserRoles } from '@/core/auth/enums/user-roles.enum';

export const updateProductUseCase = async (
  params: IUpdateProductParams,
): Promise<IProductResponse> => {
  const {
    productId,
    restaurantId,
    lang,
    dto,
    user,
    logger,
    repository,
    translationService,
  } = params;

  const { product } = await findOneProductUseCase({
    term: productId,
    restaurantId,
    lang,
    repository,
    translationService,
    logger,
  });

  if (!product) {
    logger.warn(`Update failed - Product not found: ${productId}`);
    throw new BadRequestException(
      translationService.translate('errors.product_not_found', lang),
    );
  }

  const canModifyAnyProduct =
    user.roles?.includes(UserRoles.ADMIN) ||
    user.roles?.includes(UserRoles.SUPER) ||
    false;

  if (!canModifyAnyProduct && product.restaurant.user.id !== user.id) {
    logger.warn(
      `Update failed - User ${user.id} tried to modify product ${product.id} not owned by them`,
    );
    throw new BadRequestException(
      translationService.translate('errors.product_not_owned', lang),
    );
  }

  Object.assign(product, dto);
  await repository.save(product);

  logger.log(`Product updated: ${product.name} by user: ${user.email}`);

  return {
    product,
    message: translationService.translate('products.product_updated', lang),
  };
};
