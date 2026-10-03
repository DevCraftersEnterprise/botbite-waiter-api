import { AccessControlService } from '@/core/access/access-control.service';
import {
  CreateRestaurant,
  RestaurantResponse,
} from '@/modules/restaurants/interfaces/restaurants.interfaces';

export const createRestaurantUseCase = async (
  params: CreateRestaurant,
): Promise<RestaurantResponse> => {
  const { dto, lang, user, logger, repository, translationService } = params;

  const data = { ...dto };
  if (!AccessControlService.isPrivileged(user)) delete data.isActive;

  const restaurant = repository.create({ ...data, userId: user.id });

  await repository.save(restaurant);

  logger.log(`Restaurant created: ${restaurant.id} by user: ${user.id}`);

  return {
    restaurant,
    message: translationService.translate(
      'restaurants.restaurant_created',
      lang,
    ),
  };
};
