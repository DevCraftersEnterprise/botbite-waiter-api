import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { CategoriesService } from '@/modules/categories/categories.service';
import { CreateCategoryDto } from '@/modules/categories/dto/create-category.dto';
import { UpdateCategoryDto } from '@/modules/categories/dto/update-category.dto';
import { Lang } from '@/common/decorators/lang.decorator';
import { AccessControlService } from '@/core/access/access-control.service';
import { Auth } from '@/core/auth/decorators/auth.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import { UserRoles } from '@/core/auth/enums/user-roles.enum';
import { FindCategoryDto } from '@/modules/categories/dto/find-category.dto';
import { User } from '@/modules/users/entities/user.entity';

const CATEGORY_ROLES = [UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT];

@Controller('categories')
export class CategoriesController {
  constructor(
    private readonly categoriesService: CategoriesService,
    private readonly accessControl: AccessControlService,
  ) {}

  @Post()
  @Auth(CATEGORY_ROLES)
  async create(
    @Body() createCategoryDto: CreateCategoryDto,
    @CurrentUser() user: User,
    @Lang() lang: string,
  ) {
    await this.accessControl.assertRestaurantAccess(
      user,
      createCategoryDto.restaurantId,
    );
    return this.categoriesService.create(createCategoryDto, lang);
  }

  @Get()
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT, UserRoles.USER])
  async findAll(
    @Query() findCategoryDto: FindCategoryDto,
    @CurrentUser() user: User,
  ) {
    const { limit, offset, ...searchFilters } = findCategoryDto;
    await this.accessControl.assertRestaurantAccess(
      user,
      searchFilters.restaurantId,
      'restaurant',
    );
    return this.categoriesService.findAll({ limit, offset }, searchFilters);
  }

  @Get(':id')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT, UserRoles.USER])
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
    @Lang() lang: string,
  ) {
    await this.accessControl.assertCategoryAccess(user, id, 'restaurant');
    return this.categoriesService.findOne(id, lang);
  }

  @Patch(':id')
  @Auth(CATEGORY_ROLES)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCategoryDto: UpdateCategoryDto,
    @CurrentUser() user: User,
    @Lang() lang: string,
  ) {
    await this.accessControl.assertCategoryAccess(user, id);
    return this.categoriesService.update(id, updateCategoryDto, lang);
  }

  @Delete(':id')
  @Auth(CATEGORY_ROLES)
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
    @Lang() lang: string,
  ) {
    await this.accessControl.assertCategoryAccess(user, id);
    return this.categoriesService.remove(id, lang);
  }
}
