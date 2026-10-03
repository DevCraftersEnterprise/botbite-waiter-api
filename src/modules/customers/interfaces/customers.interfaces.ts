import { Customer } from '@/modules/customers/entities/customer.entity';

export interface CustomerResponse {
  customer: Customer | null;
  message: string;
}
