import {
  ICreateProductParams,
  IProductResponse,
} from '@/modules/products/interfaces/products.interfaces';

export const createProductUseCase = async (
  params: ICreateProductParams,
): Promise<IProductResponse> => {
  const { restaurantId, dto, lang, repository, translationService } = params;

  const product = repository.create({
    ...dto,
    restaurant: { id: restaurantId },
  });

  await repository.save(product);

  return {
    product,
    message: translationService.translate('products.product_created', lang),
  };
};
