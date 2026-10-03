import { BadRequestException } from '@nestjs/common';
import {
  ChangeRestaurantStatus,
  RestaurantResponse,
} from '@/modules/restaurants/interfaces/restaurants.interfaces';
import { findOneRestaurantUseCase } from '@/modules/restaurants/use-cases/find-one-restaurant.use-case';

/** Solo SUPER/ADMIN llegan aquí (lo restringe el controlador). */
export const changeRestaurantStatusUseCase = async (
  params: ChangeRestaurantStatus,
): Promise<RestaurantResponse> => {
  const {
    restaurantId,
    lang,
    status,
    repository,
    translationService,
    logger,
    user,
  } = params;

  const { restaurant } = await findOneRestaurantUseCase({
    lang,
    repository,
    term: restaurantId,
    translationService,
  });

  if (restaurant.isActive === status) {
    throw new BadRequestException(
      translationService.translate(
        status
          ? 'restaurants.restaurant_already_active'
          : 'restaurants.restaurant_already_inactive',
        lang,
      ),
    );
  }

  await repository.update({ id: restaurant.id }, { isActive: status });
  restaurant.isActive = status;

  logger.log(
    `Restaurant ${status ? 'activated' : 'deactivated'}: ${restaurant.id} by user: ${user.id}`,
  );

  return {
    restaurant,
    message: translationService.translate(
      status
        ? 'restaurants.restaurant_activated'
        : 'restaurants.restaurant_deactivated',
      lang,
    ),
  };
};
