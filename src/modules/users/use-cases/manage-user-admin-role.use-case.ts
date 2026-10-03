import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UserRoles } from '@/core/auth/enums/user-roles.enum';
import {
  ManageUserAdminRole,
  UserResponse,
} from '@/modules/users/interfaces/users.interfaces';
import { findUserEntityUseCase } from '@/modules/users/use-cases/find-user.use-case';
import { canManageUserUtil } from '@/modules/users/utils/can-manage-user.util';
import { sanitizeUserResponse } from '@/modules/users/utils/sanitized-user.util';

export const manageUserAdminRoleUseCase = async (
  params: ManageUserAdminRole,
): Promise<UserResponse> => {
  const {
    actor,
    userId,
    lang,
    addRole,
    repository,
    translationService,
    logger,
  } = params;

  const user = await findUserEntityUseCase({
    term: userId,
    lang,
    repository,
    translationService,
  });

  // Quitar el rol admin solo lo puede hacer un SUPER; darlo, quien pueda
  // gestionar a ese usuario.
  const allowed = addRole
    ? canManageUserUtil(actor, user)
    : actor.roles.includes(UserRoles.SUPER) && canManageUserUtil(actor, user);

  if (!allowed) {
    logger.warn(
      `User ${actor.id} is not allowed to change admin role of user ${user.id}`,
    );
    throw new ForbiddenException('You cannot modify this user');
  }

  if (!user.isActive) {
    throw new BadRequestException(
      translationService.translate('users.user_inactive', lang),
    );
  }

  const roles = user.roles ?? [];

  if (addRole && roles.includes(UserRoles.CLIENT)) {
    throw new BadRequestException(
      translationService.translate('users.user_is_client', lang),
    );
  }

  if (addRole && roles.includes(UserRoles.ADMIN)) {
    throw new BadRequestException(
      translationService.translate('users.user_already_admin', lang),
    );
  }

  if (!addRole && !roles.includes(UserRoles.ADMIN)) {
    throw new BadRequestException(
      translationService.translate('users.user_not_admin', lang),
    );
  }

  user.roles = addRole
    ? [...roles, UserRoles.ADMIN]
    : roles.filter((role) => role !== UserRoles.ADMIN);

  await repository.update({ id: user.id }, { roles: user.roles });

  logger.log(
    `Admin role ${addRole ? 'added to' : 'removed from'} user ${user.id} by ${actor.id}`,
  );

  return {
    user: sanitizeUserResponse(user),
    message: translationService.translate(
      addRole ? 'users.admin_role_added' : 'users.admin_role_removed',
      lang,
    ),
  };
};
