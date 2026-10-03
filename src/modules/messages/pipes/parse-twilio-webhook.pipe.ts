import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { WebhookDataTwilio } from '@/modules/messages/models/webhook-data.twilio';

/**
 * Valida el body del webhook contra WebhookDataTwilio descartando el resto de
 * campos que envía Twilio. El parámetro se declara como `Record` en el
 * controlador para que el ValidationPipe global (con forbidNonWhitelisted)
 * no lo rechace.
 */
@Injectable()
export class ParseTwilioWebhookPipe implements PipeTransform<
  Record<string, unknown>,
  WebhookDataTwilio
> {
  transform(value: Record<string, unknown>): WebhookDataTwilio {
    const data = plainToInstance(WebhookDataTwilio, value ?? {});
    const errors = validateSync(data, { whitelist: true });

    if (errors.length > 0)
      throw new BadRequestException('Invalid webhook payload');

    return data;
  }
}
