import { BadRequestException } from '@nestjs/common';
import {
  IProductResponse,
  IUploadProductFileParams,
} from '@/modules/products/interfaces/products.interfaces';
import { findOneProductUseCase } from '@/modules/products/use-cases/find-one-product.use-case';
import { UserRoles } from '@/core/auth/enums/user-roles.enum';
import {
  cloudinaryFolder,
  uploadPictureToCloudinary,
} from '@/common/utils/upload-to-cloudinary';

export const uploadProductFileUseCase = async (
  params: IUploadProductFileParams,
): Promise<IProductResponse> => {
  const {
    productId,
    restaurantId,
    lang,
    file,
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

  // La carpeta solo usa IDs: el nombre del restaurante lo escribe el usuario.
  const folder = cloudinaryFolder(`products/${restaurantId}`);

  const productUrl = await uploadPictureToCloudinary(
    file.buffer,
    folder,
    `product-${productId}`,
  );

  product.imageUrl = productUrl;
  await repository.save(product);

  return {
    product,
    message: translationService.translate('products.product_updated', lang),
  };
};
