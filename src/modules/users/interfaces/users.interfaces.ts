import { Logger } from '@nestjs/common';
import { RegisterUserDto } from '@/modules/users/dto/register-user.dto';
import { Repository } from 'typeorm';
import { User } from '@/modules/users/entities/user.entity';
import { TranslationService } from '@/common/services/translation.service';
import { UserRoles } from '@/core/auth/enums/user-roles.enum';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { FindUsersDto } from '@/modules/users/dto/find-users.dto';
import { UserResponseSanitized } from '@/modules/users/interfaces/user-response-sanitized.interface';

export interface UserActor {
  id: string;
  roles: UserRoles[];
}

export interface CreateUser {
  dto: RegisterUserDto;
  lang: string;
  logger: Logger;
  repository: Repository<User>;
  translationService: TranslationService;
  role: UserRoles;
}

export interface FindUser {
  term: string;
  lang: string;
  repository: Repository<User>;
  translationService: TranslationService;
}

export interface FindUsers {
  userId: string;
  paginationDto: PaginationDto;
  findUsersDto: FindUsersDto;
  repository: Repository<User>;
}

export interface ChangeUserStatus {
  actor: UserActor;
  userId: string;
  lang: string;
  status: boolean;
  repository: Repository<User>;
  translationService: TranslationService;
  logger: Logger;
}

export interface ManageUserAdminRole {
  actor: UserActor;
  userId: string;
  lang: string;
  addRole: boolean;
  repository: Repository<User>;
  translationService: TranslationService;
  logger: Logger;
}

export interface UserResponse {
  user: UserResponseSanitized;
  message: string;
}

export interface UserListResponse {
  users: User[];
  total: number;
  pagination: {
    limit: number;
    offset: number;
    totalPages: number;
    currentPage: number;
  };
}
