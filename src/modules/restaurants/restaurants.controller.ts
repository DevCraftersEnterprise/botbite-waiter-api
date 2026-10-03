import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Lang } from '@/common/decorators/lang.decorator';
import { AccessControlService } from '@/core/access/access-control.service';
import { Auth } from '@/core/auth/decorators/auth.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import { UserRoles } from '@/core/auth/enums/user-roles.enum';
import { CreateRestaurantDto } from '@/modules/restaurants/dto/create-restaurant.dto';
import { FindRestaurantsDto } from '@/modules/restaurants/dto/find-resturants.dto';
import { UpdateRestaurantDto } from '@/modules/restaurants/dto/update-restaurant.dto';
import { RestaurantsService } from '@/modules/restaurants/restaurants.service';
import { User } from '@/modules/users/entities/user.entity';

@Controller('restaurants')
export class RestaurantsController {
  constructor(
    private readonly restaurantsService: RestaurantsService,
    private readonly accessControl: AccessControlService,
  ) {}

  @Post()
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT])
  createRestaurant(
    @Body() createRestaurantDto: CreateRestaurantDto,
    @CurrentUser() user: User,
    @Lang() lang: string,
  ) {
    return this.restaurantsService.createRestaurant(
      createRestaurantDto,
      user,
      lang,
    );
  }

  @Patch(':restaurantId')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT])
  async updateRestaurant(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Body() updateRestaurantDto: UpdateRestaurantDto,
    @CurrentUser() user: User,
    @Lang() lang: string,
  ) {
    await this.accessControl.assertRestaurantAccess(user, restaurantId);
    return this.restaurantsService.updateRestaurant(
      restaurantId,
      updateRestaurantDto,
      user,
      lang,
    );
  }

  @Patch('activate/:restaurantId')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN])
  activateRestaurant(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @CurrentUser() user: User,
    @Lang() lang: string,
  ) {
    return this.restaurantsService.activateRestaurant(restaurantId, user, lang);
  }

  @Delete(':restaurantId')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN])
  deactivateRestaurant(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @CurrentUser() user: User,
    @Lang() lang: string,
  ) {
    return this.restaurantsService.deactivateRestaurant(
      restaurantId,
      user,
      lang,
    );
  }

  @Get('find-user/:term')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN])
  findRestaurantByTerm(@Param('term') term: string, @Lang() lang: string) {
    return this.restaurantsService.findRestaurantByTerm(term, lang);
  }

  @Get()
  @Auth([UserRoles.CLIENT, UserRoles.ADMIN, UserRoles.SUPER, UserRoles.USER])
  async findRestaurantsByClient(
    @Query() findRestaurantsDto: FindRestaurantsDto,
    @CurrentUser() user: User,
  ) {
    const { limit, offset, ...searchFilters } = findRestaurantsDto;

    // El personal ve los restaurantes donde tiene sucursales asignadas.
    const onlyRestaurantIds = AccessControlService.isStaff(user)
      ? await this.accessControl.getStaffRestaurantIds(user.id)
      : undefined;

    return this.restaurantsService.findAllRestaurantsByClient(
      user,
      { limit, offset },
      searchFilters,
      onlyRestaurantIds,
    );
  }
}
