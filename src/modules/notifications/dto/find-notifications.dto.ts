import { IsNotEmpty, IsUUID } from 'class-validator';

export class FindNotificationsDto {
  @IsUUID()
  @IsNotEmpty()
  branchId: string;
}
