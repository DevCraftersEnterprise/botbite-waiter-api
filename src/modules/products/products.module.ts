import { Module } from '@nestjs/common';
import { ProductsService } from '@/modules/products/products.service';
import { ProductsController } from '@/modules/products/products.controller';
import { Product } from '@/modules/products/entities/product.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from '@/common/common.module';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService],
  imports: [TypeOrmModule.forFeature([Product]), CommonModule],
  exports: [TypeOrmModule, ProductsService],
})
export class ProductsModule {}
