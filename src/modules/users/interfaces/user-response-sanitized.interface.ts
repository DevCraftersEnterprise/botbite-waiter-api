import { UserRoles } from '@/core/auth/enums/user-roles.enum';

export interface UserResponseSanitized {
  id: string;
  email: string;
  roles: UserRoles[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
