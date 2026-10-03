import { UserRoles } from '@/core/auth/enums/user-roles.enum';
import { SetMetadata } from '@nestjs/common';

export const META_ROLES = 'role-protected';

export const RoleProtected = (roles: UserRoles[]) =>
  SetMetadata(META_ROLES, [...roles]);
