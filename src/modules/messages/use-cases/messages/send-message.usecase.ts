import { errorMessage } from '@/common/utils/error.util';
import { Injectable, Logger } from '@nestjs/common';
import { MessageInstance } from 'twilio/lib/rest/api/v2010/account/message';
import { TwilioService } from '@/modules/messages/services/twilio.service';
import { splitLongMessageUtil } from '@/modules/messages/utils/split-long-message.util';

const IMAGE_MARKER = /\[SEND_IMAGE:([^\]\s]+)\]/;
const IMAGE_MARKER_GLOBAL = /\[SEND_IMAGE:[^\]]*\]/g;

/**
 * Solo se adjuntan imágenes alojadas en Cloudinary (donde la API sube las
 * fotos de productos). El marcador se genera a partir de datos de la base,
 * pero así un valor manipulado no puede hacer que Twilio descargue cualquier
 * URL.
 */
export const isAllowedMediaUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'res.cloudinary.com';
  } catch {
    return false;
  }
};

@Injectable()
export class SendMessageUseCase {
  private readonly logger = new Logger(SendMessageUseCase.name);

  constructor(private readonly twilioService: TwilioService) {}

  async execute(
    customerPhone: string,
    message: string,
    assistantPhone?: string | null,
  ): Promise<MessageInstance | null> {
    if (!assistantPhone) {
      this.logger.warn(
        'Cannot send WhatsApp message: branch has no assistant phone number',
      );
      return null;
    }

    const candidateUrl = IMAGE_MARKER.exec(message)?.[1];
    const mediaUrl =
      candidateUrl && isAllowedMediaUrl(candidateUrl)
        ? candidateUrl
        : undefined;

    const cleanedMessage = message.replace(IMAGE_MARKER_GLOBAL, '').trim();
    const messageChunks = splitLongMessageUtil(cleanedMessage);

    let lastResponse: MessageInstance | null = null;

    try {
      for (let i = 0; i < messageChunks.length; i++) {
        // La imagen solo acompaña al primer fragmento.
        lastResponse = await this.twilioService.sendWhatsAppMessage(
          customerPhone,
          messageChunks[i],
          assistantPhone,
          i === 0 ? mediaUrl : undefined,
        );

        // Pequeña pausa para que WhatsApp entregue los fragmentos en orden.
        if (i < messageChunks.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to send WhatsApp message: ${errorMessage(error)}`,
      );
      throw error;
    }

    return lastResponse;
  }
}
