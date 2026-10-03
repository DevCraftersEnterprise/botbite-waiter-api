import { NotFoundException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import {
  FindUser,
  UserResponse,
} from '@/modules/users/interfaces/users.interfaces';
import { sanitizeUserResponse } from '@/modules/users/utils/sanitized-user.util';
import { User } from '@/modules/users/entities/user.entity';

export const findUserEntityUseCase = async (
  params: FindUser,
): Promise<User> => {
  const { term, lang, repository, translationService } = params;

  const user = await repository.findOne({
    where: isUUID(term) ? { id: term } : { email: term.trim().toLowerCase() },
  });

  if (!user) {
    throw new NotFoundException(
      translationService.translate('errors.user_not_found', lang),
    );
  }

  return user;
};

export const findUserUseCase = async (
  params: FindUser,
): Promise<UserResponse> => {
  const user = await findUserEntityUseCase(params);

  return {
    user: sanitizeUserResponse(user),
    message: params.translationService.translate(
      'users.user_found',
      params.lang,
    ),
  };
};
