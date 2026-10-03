import { User } from '@/modules/users/entities/user.entity';
import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

export const CurrentUser = createParamDecorator(
  (data: keyof User | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = request.user as User | undefined;

    if (!user) throw new UnauthorizedException();

    return data ? user[data] : user;
  },
);
