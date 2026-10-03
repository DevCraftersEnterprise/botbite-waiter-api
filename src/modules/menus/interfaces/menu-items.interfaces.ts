import { MenuItem } from '@/modules/menus/entities/menu-item.entity';

export interface MenuItemResponse {
  menuItem: MenuItem;
  message: string;
}

export interface MenuItemsListResponse {
  items: MenuItem[];
  total: number;
  pagination: {
    limit: number;
    offset: number;
    totalPages: number;
    currentPage: number;
  };
}
