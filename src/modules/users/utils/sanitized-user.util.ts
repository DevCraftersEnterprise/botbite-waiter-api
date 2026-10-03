import { User } from '@/modules/users/entities/user.entity';
import { UserResponseSanitized } from '@/modules/users/interfaces/user-response-sanitized.interface';

export const sanitizeUserResponse = (user: User): UserResponseSanitized => {
  return {
    id: user.id,
    email: user.email,
    roles: user.roles,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};
