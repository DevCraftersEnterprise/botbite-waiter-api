import { Injectable } from '@nestjs/common';
import { WebhookDataTwilio } from '@/modules/messages/models/webhook-data.twilio';
import { isSupportedAudioMimeType } from '@/modules/openai/use-cases/transcribe-audio.use-case';

export interface IncomingWhatsappMessage {
  from: string;
  to: string;
  message: string;
  messageSid: string;
  profileName: string;
  hasAudio: boolean;
  audioUrl: string | null;
  audioMimeType: string | null;
}

const stripWhatsappPrefix = (value: string) => value.replace(/^whatsapp:/, '');

@Injectable()
export class ProcessIncomingWhatsappMessageUseCase {
  execute(webhookData: WebhookDataTwilio): IncomingWhatsappMessage {
    const { From, To, NumMedia, MediaUrl0, MediaContentType0 } = webhookData;

    // Solo se tratan como nota de voz los medios de audio (en v1 cualquier
    // imagen o documento se mandaba a Whisper).
    const hasAudio =
      Number(NumMedia ?? 0) > 0 &&
      !!MediaUrl0 &&
      !!MediaContentType0 &&
      isSupportedAudioMimeType(MediaContentType0);

    return {
      from: stripWhatsappPrefix(From),
      to: stripWhatsappPrefix(To),
      message: webhookData.Body ?? '',
      messageSid: webhookData.MessageSid,
      profileName: webhookData.ProfileName?.trim() || 'Cliente',
      hasAudio,
      audioUrl: hasAudio ? (MediaUrl0 ?? null) : null,
      audioMimeType: hasAudio ? (MediaContentType0 ?? null) : null,
    };
  }
}
