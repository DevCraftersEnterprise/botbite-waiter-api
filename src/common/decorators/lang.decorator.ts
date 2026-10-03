import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const langFromHeader = (header: string | undefined): string =>
  header?.split(',')[0]?.split('-')[0]?.trim() || 'es';

export const Lang = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return langFromHeader(request.headers['accept-language']);
  },
);
