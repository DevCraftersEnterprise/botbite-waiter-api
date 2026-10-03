import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CustomersService } from '@/modules/customers/customers.service';
import { Auth } from '@/core/auth/decorators/auth.decorator';
import { UserRoles } from '@/core/auth/enums/user-roles.enum';
import { CreateCustomerDto } from '@/modules/customers/dto/create-customer.dto';
import { UpdateCustomerDto } from '@/modules/customers/dto/update-customer.dto';
import { Lang } from '@/common/decorators/lang.decorator';

@Controller('customers')
@Auth([UserRoles.SUPER, UserRoles.ADMIN])
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  create(@Body() dto: CreateCustomerDto, @Lang() lang: string) {
    return this.customersService.create(dto, lang);
  }

  @Get(':term')
  findByTerm(@Param('term') term: string, @Lang() lang: string) {
    return this.customersService.findByTerm(term, lang);
  }

  @Patch(':phone')
  update(
    @Param('phone') phone: string,
    @Body() dto: UpdateCustomerDto,
    @Lang() lang: string,
  ) {
    return this.customersService.update(phone, dto, lang);
  }

  @Delete(':phone')
  remove(@Param('phone') phone: string, @Lang() lang: string) {
    return this.customersService.remove(phone, lang);
  }
}
