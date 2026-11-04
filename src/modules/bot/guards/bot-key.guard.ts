import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { BotKeysService } from '@/modules/bot/services/bot-keys.service';
import { BOT_KEY_HEADER } from '@/modules/bot/utils/bot-throttle.util';

export { BOT_KEY_HEADER };

export interface BotRequest extends Request {
  botBranchId: string;
}

/** Autentica al bot con su llave. La sucursal siempre sale de la llave. */
@Injectable()
export class BotKeyGuard implements CanActivate {
  constructor(private readonly botKeysService: BotKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<BotRequest>();
    const secret = request.headers[BOT_KEY_HEADER];

    if (typeof secret !== 'string' || !secret) {
      throw new UnauthorizedException('Missing bot key');
    }

    request.botBranchId = await this.botKeysService.authenticate(secret);

    return true;
  }
}
