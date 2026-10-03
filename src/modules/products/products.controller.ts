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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Lang } from '@/common/decorators/lang.decorator';
import {
  assertFileContent,
  uploadOptions,
} from '@/common/uploads/upload-options';
import { AccessControlService } from '@/core/access/access-control.service';
import { Auth } from '@/core/auth/decorators/auth.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import { UserRoles } from '@/core/auth/enums/user-roles.enum';
import { CreateProductDto } from '@/modules/products/dto/create-product.dto';
import { FindProductsDto } from '@/modules/products/dto/find-products.dto';
import { UpdateProductDto } from '@/modules/products/dto/update-product.dto';
import { ProductsService } from '@/modules/products/products.service';
import { User } from '@/modules/users/entities/user.entity';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly accessControl: AccessControlService,
  ) {}

  @Post(':restaurantId')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT])
  async createProduct(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Body() createProductDto: CreateProductDto,
    @CurrentUser() user: User,
    @Lang() lang: string,
  ) {
    await this.accessControl.assertRestaurantAccess(user, restaurantId);
    return this.productsService.create(restaurantId, createProductDto, lang);
  }

  @Post('bulk-upload/:restaurantId')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT])
  @UseInterceptors(FileInterceptor('file', uploadOptions('csv')))
  async bulkCreate(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
    @Lang() lang: string,
  ) {
    await this.accessControl.assertRestaurantAccess(user, restaurantId);
    return this.productsService.bulkCreate(
      restaurantId,
      assertFileContent(file, 'csv'),
      lang,
    );
  }

  @Get('restaurant/:restaurantId/:term')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT])
  async findByTerm(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('term') term: string,
    @CurrentUser() user: User,
  ) {
    await this.accessControl.assertRestaurantAccess(user, restaurantId);
    return this.productsService.findByTerm(term, restaurantId);
  }

  @Get('restaurant/:restaurantId')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT])
  async findAllByRestaurant(
    @Query() findProductsDto: FindProductsDto,
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @CurrentUser() user: User,
  ) {
    await this.accessControl.assertRestaurantAccess(user, restaurantId);
    const { limit, offset, ...searchFilters } = findProductsDto;
    return this.productsService.findAllByRestaurant(
      restaurantId,
      { limit, offset },
      searchFilters,
    );
  }

  @Patch('restaurant/:restaurantId/:productId')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT])
  async updateProduct(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() updateProductDto: UpdateProductDto,
    @CurrentUser() user: User,
    @Lang() lang: string,
  ) {
    await this.accessControl.assertRestaurantAccess(user, restaurantId);
    return this.productsService.update(
      productId,
      restaurantId,
      updateProductDto,
      user,
      lang,
    );
  }

  @Patch('activate/:restaurantId/:productId')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN])
  activateProduct(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @CurrentUser() user: User,
    @Lang() lang: string,
  ) {
    return this.productsService.activateProduct(
      productId,
      restaurantId,
      user,
      lang,
    );
  }

  @Patch('picture/:restaurantId/:productId')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT])
  @UseInterceptors(FileInterceptor('file', uploadOptions('image')))
  async uploadProductFile(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
    @Lang() lang: string,
  ) {
    await this.accessControl.assertRestaurantAccess(user, restaurantId);
    return this.productsService.uploadProductFile(
      productId,
      restaurantId,
      assertFileContent(file, 'image'),
      user,
      lang,
    );
  }

  @Delete(':restaurantId/:productId')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN])
  deactivateProduct(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @CurrentUser() user: User,
    @Lang() lang: string,
  ) {
    return this.productsService.deactivateProduct(
      productId,
      restaurantId,
      user,
      lang,
    );
  }
}
