import { slugify, uniqueSlug } from '@/common/utils/slug.util';
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

  const slug = await uniqueSlug(
    slugify(data.name, 'restaurante'),
    (candidate) =>
      repository.exists({ where: { slug: candidate }, withDeleted: true }),
  );

  const restaurant = repository.create({ ...data, slug, userId: user.id });

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
