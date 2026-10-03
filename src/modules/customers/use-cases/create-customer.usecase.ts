import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TranslationService } from '@/common/services/translation.service';
import { CreateCustomerDto } from '@/modules/customers/dto/create-customer.dto';
import { Customer } from '@/modules/customers/entities/customer.entity';
import { CustomerResponse } from '@/modules/customers/interfaces/customers.interfaces';
import { FindOneCustomerUseCase } from '@/modules/customers/use-cases/find-one-customer.usecase';

@Injectable()
export class CreateCustomerUseCase {
  private readonly logger = new Logger(CreateCustomerUseCase.name);

  constructor(
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    private readonly translationService: TranslationService,
    private readonly findOneCustomerUseCase: FindOneCustomerUseCase,
  ) {}

  async execute(
    createCustomerDto: CreateCustomerDto,
    lang: string,
  ): Promise<CustomerResponse> {
    const { customer: existingCustomer } =
      await this.findOneCustomerUseCase.execute(createCustomerDto.phone, lang);

    if (existingCustomer) {
      this.logger.warn(
        `Create failed - Customer already exists with phone: ${createCustomerDto.phone}`,
      );
      throw new BadRequestException(
        this.translationService.translate(
          'customers.customer_already_exists',
          lang,
        ),
      );
    }

    const customer = this.customerRepo.create(createCustomerDto);
    await this.customerRepo.save(customer);

    return {
      customer,
      message: this.translationService.translate(
        'customers.customer_created',
        lang,
      ),
    };
  }
}
