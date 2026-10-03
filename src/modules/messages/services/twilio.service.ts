import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import twilio, { Twilio } from 'twilio';
import { MessageInstance } from 'twilio/lib/rest/api/v2010/account/message';
import { WebhookDataTwilio } from '@/modules/messages/models/webhook-data.twilio';
import { downloadTwilioMediaUtil } from '@/modules/messages/utils/download-twilio-media.util';
import { ProcessIncomingWhatsappMessageUseCase } from '@/modules/messages/use-cases/twilio/process-incoming-whatsapp-message.usecase';
import { SendWhatsappMessageUseCase } from '@/modules/messages/use-cases/twilio/send-whatsapp-message.usecase';

@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name);
  private readonly client: Twilio;
  private readonly accountSid: string;
  private readonly authToken: string;

  constructor(
    configService: ConfigService,
    private readonly processIncomingWhatsappMessageUseCase: ProcessIncomingWhatsappMessageUseCase,
    private readonly sendWhatsappMessageUseCase: SendWhatsappMessageUseCase,
  ) {
    this.accountSid = configService.getOrThrow<string>('twilio.accountSid');
    this.authToken = configService.getOrThrow<string>('twilio.authToken');
    this.client = twilio(this.accountSid, this.authToken);
  }

  processIncomingWhatsappMessage(webhookData: WebhookDataTwilio) {
    return this.processIncomingWhatsappMessageUseCase.execute(webhookData);
  }

  sendWhatsAppMessage(
    to: string,
    message: string,
    from: string,
    mediaUrl?: string,
  ): Promise<MessageInstance> {
    return this.sendWhatsappMessageUseCase.execute(
      to,
      message,
      from,
      this.client,
      mediaUrl,
    );
  }

  downloadMedia(mediaUrl: string): Promise<Buffer> {
    return downloadTwilioMediaUtil(mediaUrl, {
      accountSid: this.accountSid,
      authToken: this.authToken,
    });
  }
}
