import { ArrayContains, FindOptionsWhere, ILike, Not } from 'typeorm';
import {
  FindUsers,
  UserListResponse,
} from '@/modules/users/interfaces/users.interfaces';
import { User } from '@/modules/users/entities/user.entity';

export const findAllUsersUseCase = async (
  params: FindUsers,
): Promise<UserListResponse> => {
  const { userId, paginationDto, findUsersDto, repository } = params;

  const { limit = 10, offset = 0 } = paginationDto;
  const { email, search, role } = findUsersDto;

  const whereConditions: FindOptionsWhere<User> = { id: Not(userId) };

  if (email) whereConditions.email = email;
  if (search) whereConditions.email = ILike(`%${search}%`);
  if (role) whereConditions.roles = ArrayContains([role]);

  const [users, total] = await repository.findAndCount({
    where: whereConditions,
    select: {
      id: true,
      email: true,
      roles: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
    order: { createdAt: 'DESC' },
    skip: offset,
    take: limit,
  });

  return {
    users,
    total,
    pagination: {
      limit,
      offset,
      totalPages: Math.ceil(total / limit),
      currentPage: Math.floor(offset / limit) + 1,
    },
  };
};
