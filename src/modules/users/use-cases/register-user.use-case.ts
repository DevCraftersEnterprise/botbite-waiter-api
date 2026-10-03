import { errorCode } from '@/common/utils/error.util';
import { BadRequestException } from '@nestjs/common';
import * as argon2 from 'argon2';
import {
  CreateUser,
  UserResponse,
} from '@/modules/users/interfaces/users.interfaces';
import { sanitizeUserResponse } from '@/modules/users/utils/sanitized-user.util';

const UNIQUE_VIOLATION = '23505';

export const registerUserUseCase = async (
  params: CreateUser,
): Promise<UserResponse> => {
  const { dto, lang, logger, repository, translationService, role } = params;

  const email = dto.email.trim().toLowerCase();

  const userExists = await repository.exists({
    where: { email },
    withDeleted: true,
  });

  if (userExists) {
    logger.warn('User registration failed - email already registered');
    throw new BadRequestException(
      translationService.translate('errors.user_exists', lang),
    );
  }

  const newUser = repository.create({
    email,
    password: await argon2.hash(dto.password),
    roles: [role],
  });

  try {
    await repository.save(newUser);
  } catch (error) {
    // Dos registros simultáneos del mismo email: el índice único decide.
    if (errorCode(error) === UNIQUE_VIOLATION) {
      throw new BadRequestException(
        translationService.translate('errors.user_exists', lang),
      );
    }
    throw error;
  }

  logger.log(`User registered: ${newUser.id} (${role})`);

  return {
    user: sanitizeUserResponse(newUser),
    message: translationService.translate('auth.registration_success', lang),
  };
};
