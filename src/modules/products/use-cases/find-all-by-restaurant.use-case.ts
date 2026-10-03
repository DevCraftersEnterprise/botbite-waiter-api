import { FindOptionsWhere, ILike } from 'typeorm';
import {
  IFindProductsParams,
  IProductListResponse,
} from '@/modules/products/interfaces/products.interfaces';
import { Product } from '@/modules/products/entities/product.entity';

export const findAllByRestaurantUseCase = async (
  params: IFindProductsParams,
): Promise<IProductListResponse> => {
  const { restaurantId, paginationDto, findProductsDto, repository } = params;

  const { limit = 10, offset = 0 } = paginationDto;
  const { name, search, isActive } = findProductsDto;

  const whereConditions: FindOptionsWhere<Product> = {
    restaurant: { id: restaurantId },
  };

  if (name) whereConditions.name = name;
  if (search) whereConditions.name = ILike(`%${search}%`);
  if (isActive !== undefined) whereConditions.isActive = isActive;

  const [products, total] = await repository.findAndCount({
    where: whereConditions,
    relations: {
      restaurant: true,
    },
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      imageUrl: true,
      createdAt: true,
      restaurant: {
        name: true,
      },
    },
    order: { createdAt: 'DESC' },
    skip: offset,
    take: limit,
  });

  return {
    products,
    total,
    pagination: {
      limit,
      offset,
      totalPages: Math.ceil(total / limit),
      currentPage: Math.floor(offset / limit) + 1,
    },
  };
};
