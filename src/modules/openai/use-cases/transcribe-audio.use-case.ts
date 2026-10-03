import OpenAI, { toFile } from 'openai';

interface TranscribeAudioParams {
  openai: OpenAI;
  audioBuffer: Buffer;
  mimeType: string;
}

// Límite de Whisper.
export const MAX_AUDIO_SIZE_BYTES = 25 * 1024 * 1024;

const MIME_TO_EXTENSION: Record<string, string> = {
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'm4a',
  'audio/amr': 'amr',
  'audio/wav': 'wav',
  'audio/webm': 'webm',
};

export const isSupportedAudioMimeType = (mimeType: string): boolean =>
  mimeType.split(';')[0].trim().toLowerCase() in MIME_TO_EXTENSION;

export const transcribeAudioUseCase = async (
  params: TranscribeAudioParams,
): Promise<string> => {
  const { openai, audioBuffer, mimeType } = params;

  if (audioBuffer.length > MAX_AUDIO_SIZE_BYTES) {
    throw new Error('AUDIO_TOO_LARGE');
  }

  const baseMime = mimeType.split(';')[0].trim().toLowerCase();
  const extension = MIME_TO_EXTENSION[baseMime] ?? 'ogg';

  // Se envía desde memoria: no hace falta escribir archivos temporales.
  const file = await toFile(audioBuffer, `audio.${extension}`, {
    type: baseMime,
  });

  // Sin `language`: el bot atiende en varios idiomas y Whisper lo detecta solo.
  const transcription = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
  });

  return transcription.text;
};
