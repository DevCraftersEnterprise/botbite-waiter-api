import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { BotRequest } from '@/modules/bot/guards/bot-key.guard';

/** Sucursal de la llave con la que se autenticó el bot. */
export const BotBranchId = createParamDecorator(
  (_: unknown, context: ExecutionContext): string =>
    context.switchToHttp().getRequest<BotRequest>().botBranchId,
);
