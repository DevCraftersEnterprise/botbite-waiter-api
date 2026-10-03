import { PartialType } from '@nestjs/mapped-types';
import { CreateMenuDto } from '@/modules/menus/dto/create-menu.dto';

export class UpdateMenuDto extends PartialType(CreateMenuDto) {}
