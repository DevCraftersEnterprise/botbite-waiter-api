import { NotFoundException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import {
  FindRestaurant,
  RestaurantResponse,
} from '@/modules/restaurants/interfaces/restaurants.interfaces';

export const findOneRestaurantUseCase = async (
  params: FindRestaurant,
): Promise<RestaurantResponse> => {
  const { term, lang, repository, translationService } = params;

  const restaurant = await repository.findOne({
    where: isUUID(term) ? { id: term } : { name: term },
    relations: { user: true },
    select: {
      id: true,
      name: true,
      logoUrl: true,
      isActive: true,
      userId: true,
      user: { id: true, isActive: true },
    },
  });

  if (!restaurant) {
    throw new NotFoundException(
      translationService.translate('errors.restaurant_not_found', lang),
    );
  }

  return {
    restaurant,
    message: translationService.translate('restaurants.restaurant_found', lang),
  };
};
