import { Injectable, Logger } from '@nestjs/common';
import { Twilio } from 'twilio';
import { MessageListInstanceCreateOptions } from 'twilio/lib/rest/api/v2010/account/message';

const withWhatsappPrefix = (phone: string) =>
  phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`;

@Injectable()
export class SendWhatsappMessageUseCase {
  private readonly logger = new Logger(SendWhatsappMessageUseCase.name);

  async execute(
    to: string,
    message: string,
    from: string,
    client: Twilio,
    mediaUrl?: string,
  ) {
    const messagePayload: MessageListInstanceCreateOptions = {
      body: message,
      from: withWhatsappPrefix(from),
      to: withWhatsappPrefix(to),
    };

    if (mediaUrl) messagePayload.mediaUrl = [mediaUrl];

    const messageResponse = await client.messages.create(messagePayload);

    this.logger.log(`WhatsApp message sent: ${messageResponse.sid}`);
    return messageResponse;
  }
}
