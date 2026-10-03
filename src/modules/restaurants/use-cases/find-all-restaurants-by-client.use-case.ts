import { FindOptionsWhere, ILike, In } from 'typeorm';
import { AccessControlService } from '@/core/access/access-control.service';
import {
  FindRestaurants,
  RestaurantListResponse,
} from '@/modules/restaurants/interfaces/restaurants.interfaces';
import { Restaurant } from '@/modules/restaurants/entities/restaurant.entity';

export const findAllRestaurantsByClientUseCase = async (
  params: FindRestaurants,
): Promise<RestaurantListResponse> => {
  const {
    paginationDto,
    findRestaurantsDto,
    user,
    repository,
    onlyRestaurantIds,
  } = params;

  const { limit = 10, offset = 0 } = paginationDto;
  const { name, search, isActive, userEmail } = findRestaurantsDto;

  const whereConditions: FindOptionsWhere<Restaurant> = {};

  if (onlyRestaurantIds) {
    // Personal de sucursal: solo los restaurantes donde tiene asignaciones.
    if (onlyRestaurantIds.length === 0) {
      return {
        restaurants: [],
        total: 0,
        pagination: { limit, offset, totalPages: 0, currentPage: 1 },
      };
    }
    whereConditions.id = In(onlyRestaurantIds);
  } else if (!AccessControlService.isPrivileged(user)) {
    whereConditions.userId = user.id;
  }

  if (name) whereConditions.name = name;
  if (search) whereConditions.name = ILike(`%${search}%`);
  if (isActive !== undefined) whereConditions.isActive = isActive;
  if (userEmail) whereConditions.user = { email: ILike(`%${userEmail}%`) };

  const [restaurants, total] = await repository.findAndCount({
    where: whereConditions,
    relations: { user: true },
    select: {
      id: true,
      name: true,
      logoUrl: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      user: {
        id: true,
        email: true,
        isActive: true,
      },
    },
    order: { createdAt: 'DESC' },
    skip: offset,
    take: limit,
  });

  return {
    restaurants,
    total,
    pagination: {
      limit,
      offset,
      totalPages: Math.ceil(total / limit),
      currentPage: Math.floor(offset / limit) + 1,
    },
  };
};
