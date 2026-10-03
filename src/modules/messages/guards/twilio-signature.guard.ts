import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { validateRequest } from 'twilio';

/**
 * Verifica la cabecera X-Twilio-Signature del webhook.
 *
 * Sin esto cualquiera podía enviar POST /messages/webhook con un From/To/Body
 * inventados: hacerse pasar por clientes o por la caja, crear pedidos falsos,
 * gastar créditos de OpenAI/Twilio o hacer que la API descargara una URL
 * arbitraria enviando las credenciales de Twilio.
 *
 * https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */
@Injectable()
export class TwilioSignatureGuard implements CanActivate {
  private readonly logger = new Logger(TwilioSignatureGuard.name);
  private readonly authToken: string;
  private readonly accountSid: string;
  private readonly enabled: boolean;
  private readonly webhookBaseUrl?: string;

  constructor(configService: ConfigService) {
    this.authToken = configService.getOrThrow<string>('twilio.authToken');
    this.accountSid = configService.getOrThrow<string>('twilio.accountSid');
    this.enabled = configService.get<boolean>('twilio.validateSignature', true);
    this.webhookBaseUrl = configService
      .get<string>('twilio.webhookBaseUrl')
      ?.replace(/\/+$/, '');

    if (!this.enabled) {
      this.logger.warn(
        'Twilio signature validation is DISABLED. Never do this in production.',
      );
    }
  }

  canActivate(context: ExecutionContext): boolean {
    if (!this.enabled) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const signature = request.header('x-twilio-signature');
    const params = (request.body ?? {}) as Record<string, string>;

    if (!signature) {
      this.logger.warn(
        `Webhook rejected: missing signature (ip ${request.ip})`,
      );
      throw new ForbiddenException();
    }

    const url = this.buildUrl(request);

    if (!validateRequest(this.authToken, signature, url, params)) {
      this.logger.warn(
        `Webhook rejected: invalid signature for ${url} (ip ${request.ip})`,
      );
      throw new ForbiddenException();
    }

    if (params.AccountSid && params.AccountSid !== this.accountSid) {
      this.logger.warn(
        `Webhook rejected: unexpected AccountSid (ip ${request.ip})`,
      );
      throw new ForbiddenException();
    }

    return true;
  }

  /**
   * Twilio firma la URL exacta que tiene configurada. Detrás de un proxy,
   * protocolo y host se reconstruyen con `trust proxy`; si no coinciden, se
   * puede fijar TWILIO_WEBHOOK_BASE_URL.
   */
  private buildUrl(request: Request): string {
    const base =
      this.webhookBaseUrl ?? `${request.protocol}://${request.get('host')}`;
    return `${base}${request.originalUrl}`;
  }
}
