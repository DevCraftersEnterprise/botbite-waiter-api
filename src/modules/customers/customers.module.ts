import { Module } from '@nestjs/common';
import { CustomersService } from '@/modules/customers/customers.service';
import { CustomersController } from '@/modules/customers/customers.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from '@/modules/customers/entities/customer.entity';
import { CommonModule } from '@/common/common.module';
import { CreateCustomerUseCase } from '@/modules/customers/use-cases/create-customer.usecase';
import { FindOneCustomerUseCase } from '@/modules/customers/use-cases/find-one-customer.usecase';
import { UpdateCustomerUseCase } from '@/modules/customers/use-cases/update-customer.usecase';
import { RemoveCustomerUseCase } from '@/modules/customers/use-cases/remove-customer.usecase';

@Module({
  controllers: [CustomersController],
  providers: [
    CustomersService,
    CreateCustomerUseCase,
    FindOneCustomerUseCase,
    UpdateCustomerUseCase,
    RemoveCustomerUseCase,
  ],
  imports: [TypeOrmModule.forFeature([Customer]), CommonModule],
  exports: [TypeOrmModule, CustomersService],
})
export class CustomersModule {}
