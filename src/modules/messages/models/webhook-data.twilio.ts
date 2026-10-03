import {
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Campos del webhook de WhatsApp de Twilio que usa la API. Twilio envía
 * muchos más; se aceptan sin validar (ver `forbidNonWhitelisted: false` en el
 * controlador) porque la firma ya garantiza su origen.
 */
export class WebhookDataTwilio {
  @IsString()
  @MaxLength(64)
  MessageSid: string;

  @IsString()
  @MaxLength(64)
  AccountSid: string;

  @IsString()
  @MaxLength(64)
  From: string;

  @IsString()
  @MaxLength(64)
  To: string;

  @IsOptional()
  @IsString()
  @MaxLength(4096)
  Body?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  ProfileName?: string;

  @IsOptional()
  @IsNumberString()
  NumMedia?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  MediaUrl0?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  MediaContentType0?: string;
}
