import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Not } from 'typeorm';
import { AccessControlService } from '@/core/access/access-control.service';
import {
  RestaurantResponse,
  UpdateRestaurant,
} from '@/modules/restaurants/interfaces/restaurants.interfaces';
import { findOneRestaurantUseCase } from '@/modules/restaurants/use-cases/find-one-restaurant.use-case';

/**
 * La propiedad del restaurante ya se validó en el controlador con
 * AccessControlService.
 */
export const updateRestaurantUseCase = async (
  params: UpdateRestaurant,
): Promise<RestaurantResponse> => {
  const {
    restaurantId,
    lang,
    user,
    dto,
    logger,
    repository,
    translationService,
  } = params;

  const { restaurant } = await findOneRestaurantUseCase({
    term: restaurantId,
    lang,
    repository,
    translationService,
  });

  const changes = { ...dto };

  // Activar/desactivar restaurantes es una decisión de administración: un
  // cliente no puede reactivar un restaurante que un admin desactivó.
  if (!AccessControlService.isPrivileged(user)) {
    delete changes.isActive;
    if (changes.slug !== undefined) {
      throw new ForbiddenException('Only administrators can change the slug');
    }
  }

  if (changes.slug) {
    const taken = await repository.exists({
      where: { slug: changes.slug, id: Not(restaurant.id) },
      withDeleted: true,
    });
    if (taken) throw new ConflictException('The slug is already in use');
  }

  await repository.update({ id: restaurant.id }, changes);
  Object.assign(restaurant, changes);

  logger.log(`Restaurant updated: ${restaurantId} by user: ${user.id}`);

  return {
    restaurant,
    message: translationService.translate(
      'restaurants.restaurant_updated',
      lang,
    ),
  };
};
