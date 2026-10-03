import { Category } from '@/modules/categories/entities/category.entity';

export interface CategoryResponse {
  category: Category;
  message: string;
}

export interface CategoryListResponse {
  categories: Category[];
  total: number;
  pagination: {
    limit: number;
    offset: number;
    totalPages: number;
    currentPage: number;
  };
}
