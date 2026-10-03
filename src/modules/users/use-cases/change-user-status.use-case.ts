import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  ChangeUserStatus,
  UserResponse,
} from '@/modules/users/interfaces/users.interfaces';
import { findUserEntityUseCase } from '@/modules/users/use-cases/find-user.use-case';
import { canManageUserUtil } from '@/modules/users/utils/can-manage-user.util';
import { sanitizeUserResponse } from '@/modules/users/utils/sanitized-user.util';

export const changeUserStatusUseCase = async (
  params: ChangeUserStatus,
): Promise<UserResponse> => {
  const {
    actor,
    userId,
    lang,
    status,
    repository,
    translationService,
    logger,
  } = params;

  const user = await findUserEntityUseCase({
    lang,
    repository,
    term: userId,
    translationService,
  });

  if (!canManageUserUtil(actor, user)) {
    logger.warn(
      `User ${actor.id} is not allowed to change status of user ${user.id}`,
    );
    throw new ForbiddenException('You cannot modify this user');
  }

  if (user.isActive === status) {
    throw new BadRequestException(
      translationService.translate(
        status ? 'users.user_already_active' : 'users.user_already_inactive',
        lang,
      ),
    );
  }

  await repository.update({ id: user.id }, { isActive: status });
  user.isActive = status;

  logger.log(
    `User ${status ? 'activated' : 'deactivated'}: ${user.id} by ${actor.id}`,
  );

  return {
    user: sanitizeUserResponse(user),
    message: translationService.translate(
      status ? 'users.user_activated' : 'users.user_deactivated',
      lang,
    ),
  };
};
