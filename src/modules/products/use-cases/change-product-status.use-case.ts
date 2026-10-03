import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  IChangeProductStatusParams,
  IProductResponse,
} from '@/modules/products/interfaces/products.interfaces';
import { findOneProductUseCase } from '@/modules/products/use-cases/find-one-product.use-case';
import { UserRoles } from '@/core/auth/enums/user-roles.enum';

export const changeProductStatusUseCase = async (
  params: IChangeProductStatusParams,
): Promise<IProductResponse> => {
  const {
    productId,
    restaurantId,
    lang,
    status,
    user,
    repository,
    logger,
    translationService,
  } = params;

  const action = status ? 'Activate' : 'Deactivate';
  const actionLower = action.toLowerCase();

  const { product } = await findOneProductUseCase({
    term: productId,
    restaurantId,
    lang,
    repository,
    logger,
    translationService,
  });

  if (!product) {
    logger.warn(`${action} failed - Product not found: ${productId}`);
    throw new NotFoundException(
      translationService.translate('errors.product_not_found', lang),
    );
  }

  const canModifyAnyProduct =
    user.roles?.includes(UserRoles.ADMIN) ||
    user.roles?.includes(UserRoles.SUPER) ||
    false;

  if (!canModifyAnyProduct && product.restaurant.user.id !== user.id) {
    logger.warn(
      `${action} failed - User ${user.id} tried to ${actionLower} product ${product.id} not owned by them`,
    );
    throw new BadRequestException(
      translationService.translate('errors.product_not_owned', lang),
    );
  }

  if (product.isActive === status) {
    const alreadyStatus = status ? 'active' : 'inactive';
    logger.warn(
      `${action} failed - Product already ${alreadyStatus}: ${product.id}`,
    );
    throw new BadRequestException(
      translationService.translate(
        `products.product_already_${alreadyStatus}`,
        lang,
      ),
    );
  }

  product.isActive = status;
  await repository.save(product);

  logger.log(
    `Product ${status ? 'activated' : 'deactivated'}: ${product.id} by user: ${user.email}`,
  );

  return {
    product,
    message: translationService.translate(
      `products.product_${status ? 'activated' : 'deactivated'}`,
      lang,
    ),
  };
};
