import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { TranslationService } from '@/common/services/translation.service';
import { CreateRestaurantDto } from '@/modules/restaurants/dto/create-restaurant.dto';
import { FindRestaurantsDto } from '@/modules/restaurants/dto/find-resturants.dto';
import { UpdateRestaurantDto } from '@/modules/restaurants/dto/update-restaurant.dto';
import { Restaurant } from '@/modules/restaurants/entities/restaurant.entity';
import { changeRestaurantStatusUseCase } from '@/modules/restaurants/use-cases/change-restaurant-status.use-case';
import { createRestaurantUseCase } from '@/modules/restaurants/use-cases/create-restaurant.use-case';
import { findAllRestaurantsByClientUseCase } from '@/modules/restaurants/use-cases/find-all-restaurants-by-client.use-case';
import { findOneRestaurantUseCase } from '@/modules/restaurants/use-cases/find-one-restaurant.use-case';
import { updateRestaurantUseCase } from '@/modules/restaurants/use-cases/update-restaurant.use-case';
import { User } from '@/modules/users/entities/user.entity';

@Injectable()
export class RestaurantsService {
  private readonly logger = new Logger(RestaurantsService.name);

  constructor(
    @InjectRepository(Restaurant)
    private readonly restaurantRepository: Repository<Restaurant>,
    private readonly translationService: TranslationService,
  ) {}

  createRestaurant(
    createRestaurantDto: CreateRestaurantDto,
    user: User,
    lang: string,
  ) {
    return createRestaurantUseCase({
      dto: createRestaurantDto,
      user,
      lang,
      logger: this.logger,
      repository: this.restaurantRepository,
      translationService: this.translationService,
    });
  }

  updateRestaurant(
    restaurantId: string,
    updateRestaurantDto: UpdateRestaurantDto,
    user: User,
    lang: string,
  ) {
    return updateRestaurantUseCase({
      restaurantId,
      lang,
      user,
      dto: updateRestaurantDto,
      logger: this.logger,
      repository: this.restaurantRepository,
      translationService: this.translationService,
    });
  }

  activateRestaurant(restaurantId: string, user: User, lang: string) {
    return this.changeStatus(restaurantId, user, lang, true);
  }

  deactivateRestaurant(restaurantId: string, user: User, lang: string) {
    return this.changeStatus(restaurantId, user, lang, false);
  }

  findAllRestaurantsByClient(
    user: User,
    paginationDto: PaginationDto,
    searchRestaurantsDto: FindRestaurantsDto = {},
    onlyRestaurantIds?: string[],
  ) {
    return findAllRestaurantsByClientUseCase({
      user,
      paginationDto,
      findRestaurantsDto: searchRestaurantsDto,
      repository: this.restaurantRepository,
      onlyRestaurantIds,
    });
  }

  findRestaurantByTerm(term: string, lang = 'es') {
    return findOneRestaurantUseCase({
      lang,
      repository: this.restaurantRepository,
      term,
      translationService: this.translationService,
    });
  }

  private changeStatus(
    restaurantId: string,
    user: User,
    lang: string,
    status: boolean,
  ) {
    return changeRestaurantStatusUseCase({
      restaurantId,
      lang,
      status,
      user,
      repository: this.restaurantRepository,
      translationService: this.translationService,
      logger: this.logger,
    });
  }
}
