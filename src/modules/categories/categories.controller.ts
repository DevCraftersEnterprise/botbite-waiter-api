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
import { Auth } from '@/core/auth/decorators/auth.decorator';
import { UserRoles } from '@/core/auth/enums/user-roles.enum';
import { FindCategoryDto } from '@/modules/categories/dto/find-category.dto';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @Auth([UserRoles.SUPER, UserRoles.ADMIN])
  create(@Body() createCategoryDto: CreateCategoryDto, @Lang() lang: string) {
    return this.categoriesService.create(createCategoryDto, lang);
  }

  @Get()
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT, UserRoles.USER])
  findAll(@Query() findCategoryDto: FindCategoryDto) {
    const { limit, offset, ...searchFilters } = findCategoryDto;
    return this.categoriesService.findAll({ limit, offset }, searchFilters);
  }

  @Get(':id')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT, UserRoles.USER])
  findOne(@Param('id', ParseIntPipe) id: number, @Lang() lang: string) {
    return this.categoriesService.findOne(id, lang);
  }

  @Patch(':id')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN])
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCategoryDto: UpdateCategoryDto,
    @Lang() lang: string,
  ) {
    return this.categoriesService.update(id, updateCategoryDto, lang);
  }

  @Delete(':id')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN])
  remove(@Param('id', ParseIntPipe) id: number, @Lang() lang: string) {
    return this.categoriesService.remove(id, lang);
  }
}
