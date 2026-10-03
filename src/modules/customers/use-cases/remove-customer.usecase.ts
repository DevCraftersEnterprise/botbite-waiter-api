import { Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TranslationService } from '@/common/services/translation.service';
import { Customer } from '@/modules/customers/entities/customer.entity';
import { CustomerResponse } from '@/modules/customers/interfaces/customers.interfaces';
import { FindOneCustomerUseCase } from '@/modules/customers/use-cases/find-one-customer.usecase';

export class RemoveCustomerUseCase {
  private readonly logger = new Logger(RemoveCustomerUseCase.name);

  constructor(
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    private readonly translationService: TranslationService,
    private readonly findOneCustomerUseCase: FindOneCustomerUseCase,
  ) {}

  async execute(phone: string, lang: string): Promise<CustomerResponse> {
    const { customer } = await this.findOneCustomerUseCase.execute(phone, lang);

    if (!customer) {
      throw new NotFoundException(
        this.translationService.translate('customers.customer_not_found', lang),
      );
    }

    customer.isActive = false;
    await this.customerRepo.save(customer);

    this.logger.log(`Customer deleted: ${customer.name} (${phone})`);

    return {
      customer,
      message: this.translationService.translate(
        'customers.customer_deleted',
        lang,
      ),
    };
  }
}
