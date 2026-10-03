import { Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TranslationService } from '@/common/services/translation.service';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { Restaurant } from '@/modules/restaurants/entities/restaurant.entity';
import { FindRestaurantsDto } from '@/modules/restaurants/dto/find-resturants.dto';
import { CreateRestaurantDto } from '@/modules/restaurants/dto/create-restaurant.dto';
import { UpdateRestaurantDto } from '@/modules/restaurants/dto/update-restaurant.dto';
import { User } from '@/modules/users/entities/user.entity';

export interface CreateRestaurant {
  dto: CreateRestaurantDto;
  user: User;
  lang: string;
  logger: Logger;
  repository: Repository<Restaurant>;
  translationService: TranslationService;
}

export interface UpdateRestaurant {
  restaurantId: string;
  lang: string;
  user: User;
  dto: UpdateRestaurantDto;
  logger: Logger;
  repository: Repository<Restaurant>;
  translationService: TranslationService;
}

export interface FindRestaurant {
  term: string;
  lang: string;
  repository: Repository<Restaurant>;
  translationService: TranslationService;
}

export interface FindRestaurants {
  user: User;
  paginationDto: PaginationDto;
  findRestaurantsDto: FindRestaurantsDto;
  repository: Repository<Restaurant>;
  /** Si se indica, solo se listan estos restaurantes (personal de sucursal). */
  onlyRestaurantIds?: string[];
}

export interface ChangeRestaurantStatus {
  restaurantId: string;
  lang: string;
  status: boolean;
  user: User;
  repository: Repository<Restaurant>;
  translationService: TranslationService;
  logger: Logger;
}

export interface RestaurantResponse {
  restaurant: Restaurant;
  message: string;
}

export interface RestaurantListResponse {
  restaurants: Restaurant[];
  total: number;
  pagination: {
    limit: number;
    offset: number;
    totalPages: number;
    currentPage: number;
  };
}
