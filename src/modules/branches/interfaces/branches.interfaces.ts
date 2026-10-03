import { Branch } from '@/modules/branches/entities/branch.entity';

export interface CsvBranchRow {
  nombre: string;
  direccion: string;
}

export interface BranchResponse {
  branch: Branch;
  message: string;
}

export interface BulkCreateBranchesResponse {
  branches: Branch[];
  count: number;
  message: string;
}

export interface BranchListResponse {
  branches: Branch[];
  total: number;
  pagination: {
    limit: number;
    offset: number;
    totalPages: number;
    currentPage: number;
  };
}

export interface QrGenerationResponse {
  qrUrl: string;
}
