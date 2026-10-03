import { RoleProtected } from '@/core/auth/decorators/role-protected.decorator';
import { UserRoles } from '@/core/auth/enums/user-roles.enum';
import { JwtAuthGuard } from '@/core/auth/guards/jwt-auth.guard';
import { UserRoleGuard } from '@/core/auth/guards/user-role.guard';
import { applyDecorators, UseGuards } from '@nestjs/common';

/**
 * Exige un access token válido y alguno de los roles indicados.
 * El acceso a recursos de un restaurante concreto se valida aparte con
 * AccessControlService.
 */
export const Auth = (roles: UserRoles[]) => {
  return applyDecorators(
    RoleProtected(roles),
    UseGuards(JwtAuthGuard, UserRoleGuard),
  );
};
