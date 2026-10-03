import { Module } from '@nestjs/common';
import { RestaurantsService } from '@/modules/restaurants/restaurants.service';
import { RestaurantsController } from '@/modules/restaurants/restaurants.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Restaurant } from '@/modules/restaurants/entities/restaurant.entity';
import { CommonModule } from '@/common/common.module';

@Module({
  controllers: [RestaurantsController],
  providers: [RestaurantsService],
  imports: [TypeOrmModule.forFeature([Restaurant]), CommonModule],
  exports: [TypeOrmModule, RestaurantsService],
})
export class RestaurantsModule {}
