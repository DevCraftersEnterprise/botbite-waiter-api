import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from '@/modules/products/entities/product.entity';
import { Repository } from 'typeorm';
import { TranslationService } from '@/common/services/translation.service';
import { CreateProductDto } from '@/modules/products/dto/create-product.dto';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { FindProductsDto } from '@/modules/products/dto/find-products.dto';
import { UpdateProductDto } from '@/modules/products/dto/update-product.dto';
import { User } from '@/modules/users/entities/user.entity';
import { createProductUseCase } from '@/modules/products/use-cases/create-product.use-case';
import { bulkCreateProductsUseCase } from '@/modules/products/use-cases/bulk-create-products.use-case';
import { findOneProductUseCase } from '@/modules/products/use-cases/find-one-product.use-case';
import { updateProductUseCase } from '@/modules/products/use-cases/update-product.use-case';
import { changeProductStatusUseCase } from '@/modules/products/use-cases/change-product-status.use-case';
import { findAllByRestaurantUseCase } from '@/modules/products/use-cases/find-all-by-restaurant.use-case';
import { uploadProductFileUseCase } from '@/modules/products/use-cases/upload-product-file.use-case';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly translationService: TranslationService,
  ) {}

  async create(
    restaurantId: string,
    createProductDto: CreateProductDto,
    lang: string,
  ) {
    return createProductUseCase({
      restaurantId,
      dto: createProductDto,
      lang,
      repository: this.productRepository,
      translationService: this.translationService,
    });
  }

  async bulkCreate(
    restaurantId: string,
    file: Express.Multer.File,
    lang: string,
  ) {
    return bulkCreateProductsUseCase({
      file,
      repository: this.productRepository,
      logger: this.logger,
      translationService: this.translationService,
      restaurantId,
      lang,
    });
  }

  async update(
    productId: string,
    restaurantId: string,
    updateProductDto: UpdateProductDto,
    user: User,
    lang: string,
  ) {
    return updateProductUseCase({
      productId,
      restaurantId,
      dto: updateProductDto,
      user,
      lang,
      logger: this.logger,
      repository: this.productRepository,
      translationService: this.translationService,
    });
  }

  async activateProduct(
    productId: string,
    restaurantId: string,
    user: User,
    lang: string,
  ) {
    return changeProductStatusUseCase({
      productId,
      restaurantId,
      lang,
      status: true,
      user,
      repository: this.productRepository,
      logger: this.logger,
      translationService: this.translationService,
    });
  }

  async deactivateProduct(
    productId: string,
    restaurantId: string,
    user: User,
    lang: string,
  ) {
    return changeProductStatusUseCase({
      productId,
      restaurantId,
      lang,
      status: false,
      user,
      repository: this.productRepository,
      logger: this.logger,
      translationService: this.translationService,
    });
  }

  async findByTerm(term: string, restaurantId: string) {
    return findOneProductUseCase({
      term,
      restaurantId,
      lang: 'es',
      repository: this.productRepository,
      logger: this.logger,
      translationService: this.translationService,
    });
  }

  async findAllByRestaurant(
    restaurantId: string,
    paginationDto: PaginationDto,
    findProductsDto: FindProductsDto = {},
  ) {
    return findAllByRestaurantUseCase({
      restaurantId,
      paginationDto,
      findProductsDto,
      repository: this.productRepository,
    });
  }

  async uploadProductFile(
    productId: string,
    restaurantId: string,
    file: Express.Multer.File,
    user: User,
    lang: string,
  ) {
    return uploadProductFileUseCase({
      productId,
      restaurantId,
      lang,
      file,
      user,
      logger: this.logger,
      repository: this.productRepository,
      translationService: this.translationService,
    });
  }
}
