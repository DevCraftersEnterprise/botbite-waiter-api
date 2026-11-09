import { Module } from '@nestjs/common';
import { CustomersService } from '@/modules/customers/customers.service';
import { CustomersController } from '@/modules/customers/customers.controller';
import { RestaurantCustomersController } from '@/modules/customers/restaurant-customers.controller';
import { CustomerReportService } from '@/modules/customers/services/customer-report.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerTaxProfile } from '@/modules/customers/entities/customer-tax-profile.entity';
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
  controllers: [CustomersController, RestaurantCustomersController],
  providers: [
    CustomersService,
    RestaurantCustomersService,
    CustomerReportService,
    CreateCustomerUseCase,
    FindOneCustomerUseCase,
    UpdateCustomerUseCase,
    RemoveCustomerUseCase,
  ],
  imports: [
    TypeOrmModule.forFeature([
      Customer,
      RestaurantCustomer,
      WalletMovement,
      CustomerTaxProfile,
    ]),
    CommonModule,
  ],
  exports: [TypeOrmModule, CustomersService, RestaurantCustomersService],
})
export class CustomersModule {}
