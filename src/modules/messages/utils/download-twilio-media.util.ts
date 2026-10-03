import axios from 'axios';
import { MAX_AUDIO_SIZE_BYTES } from '@/modules/openai/use-cases/transcribe-audio.use-case';

const TWILIO_MEDIA_HOST = 'api.twilio.com';

/**
 * Solo se descargan medios desde la API de Twilio. En v1 se descargaba
 * cualquier URL recibida en MediaUrl0 enviando las credenciales de Twilio por
 * Basic Auth, lo que permitía robarlas o hacer SSRF.
 */
export const isTwilioMediaUrl = (
  mediaUrl: string,
  accountSid: string,
): boolean => {
  let url: URL;
  try {
    url = new URL(mediaUrl);
  } catch {
    return false;
  }

  return (
    url.protocol === 'https:' &&
    url.hostname === TWILIO_MEDIA_HOST &&
    !url.port &&
    !url.username &&
    url.pathname.startsWith(`/2010-04-01/Accounts/${accountSid}/Messages/`)
  );
};

export const downloadTwilioMediaUtil = async (
  mediaUrl: string,
  credentials: { accountSid: string; authToken: string },
): Promise<Buffer> => {
  const { accountSid, authToken } = credentials;

  if (!isTwilioMediaUrl(mediaUrl, accountSid)) {
    throw new Error('MEDIA_URL_NOT_ALLOWED');
  }

  // Twilio redirige a su CDN; follow-redirects descarta la cabecera
  // Authorization al cambiar de host.
  const response = await axios.get<ArrayBuffer>(mediaUrl, {
    responseType: 'arraybuffer',
    auth: { username: accountSid, password: authToken },
    timeout: 15_000,
    maxRedirects: 3,
    maxContentLength: MAX_AUDIO_SIZE_BYTES,
    maxBodyLength: MAX_AUDIO_SIZE_BYTES,
  });

  return Buffer.from(response.data);
};
