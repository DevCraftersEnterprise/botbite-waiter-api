import { PartialType } from '@nestjs/mapped-types';
import { CreateMenuItemDto } from '@/modules/menus/dto/create-menu-item.dto';

export class UpdateMenuItemDto extends PartialType(CreateMenuItemDto) {}
