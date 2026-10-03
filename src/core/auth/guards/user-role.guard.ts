import { META_ROLES } from '@/core/auth/decorators/role-protected.decorator';
import { UserRoles } from '@/core/auth/enums/user-roles.enum';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

@Injectable()
export class UserRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRoles[] | undefined>(
      META_ROLES,
      [context.getHandler(), context.getClass()],
    );

    if (!roles) return true;

    const user = context.switchToHttp().getRequest<Request>().user as
      | { roles?: UserRoles[] }
      | undefined;

    if (!user) throw new UnauthorizedException();

    const hasValidRole = (user.roles ?? []).some((role) =>
      roles.includes(role),
    );

    // No se incluyen email ni roles en el mensaje para no filtrar información.
    if (!hasValidRole) throw new ForbiddenException('Insufficient permissions');

    return true;
  }
}
