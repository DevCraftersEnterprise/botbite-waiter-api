import { Menu } from '@/modules/menus/entities/menu.entity';

export interface MenuResponse {
  menu: Menu;
  message: string;
}
export interface MenuListResponse {
  menus: Menu[];
  total: number;
  pagination: {
    limit: number;
    offset: number;
    totalPages: number;
    currentPage: number;
  };
}
