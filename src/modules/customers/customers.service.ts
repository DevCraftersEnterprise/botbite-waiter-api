import { Injectable, Logger } from '@nestjs/common';
import { CreateCustomerDto } from '@/modules/customers/dto/create-customer.dto';
import { UpdateCustomerDto } from '@/modules/customers/dto/update-customer.dto';
import { CustomerResponse } from '@/modules/customers/interfaces/customers.interfaces';
import { CreateCustomerUseCase } from '@/modules/customers/use-cases/create-customer.usecase';
import { FindOneCustomerUseCase } from '@/modules/customers/use-cases/find-one-customer.usecase';
import { RemoveCustomerUseCase } from '@/modules/customers/use-cases/remove-customer.usecase';
import { UpdateCustomerUseCase } from '@/modules/customers/use-cases/update-customer.usecase';

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    private readonly createCustomerUseCase: CreateCustomerUseCase,
    private readonly findOneCustomerUseCase: FindOneCustomerUseCase,
    private readonly updateCustomerUseCase: UpdateCustomerUseCase,
    private readonly removeCustomerUseCase: RemoveCustomerUseCase,
  ) {}

  async create(
    dto: CreateCustomerDto,
    lang: string,
  ): Promise<CustomerResponse> {
    return await this.createCustomerUseCase.execute(dto, lang);
  }

  async findByTerm(term: string, lang: string): Promise<CustomerResponse> {
    return await this.findOneCustomerUseCase.execute(term, lang);
  }

  async update(
    phone: string,
    dto: UpdateCustomerDto,
    lang: string,
  ): Promise<CustomerResponse> {
    return await this.updateCustomerUseCase.execute(phone, dto, lang);
  }

  async remove(phone: string, lang: string) {
    return await this.removeCustomerUseCase.execute(phone, lang);
  }
}
