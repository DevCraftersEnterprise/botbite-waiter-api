import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { Transform } from 'class-transformer';

export class FindCategoryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Name must have at least 1 character' })
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Search must have at least 2 characters' })
  search?: string;

  @IsOptional()
  @Transform(
    ({ value }) => {
      if (value === undefined || value === null) {
        return undefined;
      }

      if (typeof value === 'boolean') {
        return value;
      }

      if (typeof value === 'string') {
        if (value === '' || value === 'undefined') {
          return undefined;
        }
        if (value.toLowerCase() === 'true') {
          return true;
        }
        if (value.toLowerCase() === 'false') {
          return false;
        }
      }

      return undefined;
    },
    { toClassOnly: true },
  )
  @IsBoolean({ message: 'isActive must be true or false' })
  isActive?: boolean;
}
