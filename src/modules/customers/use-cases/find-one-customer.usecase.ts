import { isUUID } from 'class-validator';
import { CustomerResponse } from '@/modules/customers/interfaces/customers.interfaces';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Customer } from '@/modules/customers/entities/customer.entity';
import { Repository } from 'typeorm';
import { TranslationService } from '@/common/services/translation.service';

export class FindOneCustomerUseCase {
  private readonly logger = new Logger(FindOneCustomerUseCase.name);

  constructor(
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    private readonly translationService: TranslationService,
  ) {}

  async execute(term: string, lang: string): Promise<CustomerResponse> {
    const customer = await this.customerRepo.findOne({
      where: isUUID(term)
        ? { id: term, isActive: true }
        : { phone: term, isActive: true },
    });

    if (!customer) {
      this.logger.error(`Customer not found with term: ${term}`);

      return {
        customer: null,
        message: this.translationService.translate(
          'customers.customer_not_found',
          lang,
        ),
      };
    }

    return {
      customer,
      message: this.translationService.translate(
        'customers.customer_found',
        lang,
      ),
    };
  }
}
