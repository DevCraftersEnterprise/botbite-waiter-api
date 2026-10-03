import { Logger } from '@nestjs/common';
import { Product } from '@/modules/products/entities/product.entity';
import { CreateProductDto } from '@/modules/products/dto/create-product.dto';
import { Repository } from 'typeorm';
import { TranslationService } from '@/common/services/translation.service';
import { UpdateProductDto } from '@/modules/products/dto/update-product.dto';
import { User } from '@/modules/users/entities/user.entity';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { FindProductsDto } from '@/modules/products/dto/find-products.dto';

export interface ICreateProductParams {
  restaurantId: string;
  dto: CreateProductDto;
  lang: string;
  repository: Repository<Product>;
  translationService: TranslationService;
}
export interface IUpdateProductParams {
  productId: string;
  restaurantId: string;
  lang: string;
  dto: UpdateProductDto;
  user: User;
  logger: Logger;
  repository: Repository<Product>;
  translationService: TranslationService;
}

export interface IUploadProductFileParams {
  productId: string;
  restaurantId: string;
  lang: string;
  file: Express.Multer.File;
  user: User;
  logger: Logger;
  repository: Repository<Product>;
  translationService: TranslationService;
}

export interface IBulkCreateProductParams {
  file: Express.Multer.File;
  repository: Repository<Product>;
  logger: Logger;
  translationService: TranslationService;
  restaurantId: string;
  lang: string;
}

export interface IFindProductParams {
  term: string;
  restaurantId: string;
  lang: string;
  repository: Repository<Product>;
  translationService: TranslationService;
  logger: Logger;
}

export interface IFindProductsParams {
  restaurantId: string;
  paginationDto: PaginationDto;
  findProductsDto: FindProductsDto;
  repository: Repository<Product>;
}

export interface IChangeProductStatusParams {
  productId: string;
  restaurantId: string;
  lang: string;
  status: boolean;
  user: User;
  repository: Repository<Product>;
  logger: Logger;
  translationService: TranslationService;
}

export interface IProductResponse {
  product: Product;
  message: string;
}

export interface IBulkCreateProductResponse {
  products: Product[];
  count: number;
  message: string;
}

export interface IProductListResponse {
  products: Product[];
  total: number;
  pagination: {
    limit: number;
    offset: number;
    totalPages: number;
    currentPage: number;
  };
}
