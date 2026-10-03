import { IsOptional, IsEmail, IsString, IsEnum } from 'class-validator';
import { UserRoles } from '@/core/auth/enums/user-roles.enum';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class FindUsersDto extends PaginationDto {
  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(UserRoles, { message: 'Role must be a valid UserRole' })
  role?: UserRoles;
}
