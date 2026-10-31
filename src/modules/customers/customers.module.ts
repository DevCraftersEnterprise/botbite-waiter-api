import { Module } from '@nestjs/common';
import { CustomersService } from '@/modules/customers/customers.service';
import { CustomersController } from '@/modules/customers/customers.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from '@/modules/customers/entities/customer.entity';
import { RestaurantCustomer } from '@/modules/customers/entities/restaurant-customer.entity';
import { WalletMovement } from '@/modules/customers/entities/wallet-movement.entity';
import { RestaurantCustomersService } from '@/modules/customers/services/restaurant-customers.service';
import { CommonModule } from '@/common/common.module';
import { CreateCustomerUseCase } from '@/modules/customers/use-cases/create-customer.usecase';
import { FindOneCustomerUseCase } from '@/modules/customers/use-cases/find-one-customer.usecase';
import { UpdateCustomerUseCase } from '@/modules/customers/use-cases/update-customer.usecase';
import { RemoveCustomerUseCase } from '@/modules/customers/use-cases/remove-customer.usecase';

@Module({
  controllers: [CustomersController],
  providers: [
    CustomersService,
    RestaurantCustomersService,
    CreateCustomerUseCase,
    FindOneCustomerUseCase,
    UpdateCustomerUseCase,
    RemoveCustomerUseCase,
  ],
  imports: [
    TypeOrmModule.forFeature([Customer, RestaurantCustomer, WalletMovement]),
    CommonModule,
  ],
  exports: [TypeOrmModule, CustomersService, RestaurantCustomersService],
})
export class CustomersModule {}
