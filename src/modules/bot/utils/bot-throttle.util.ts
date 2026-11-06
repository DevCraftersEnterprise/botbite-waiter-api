import { createHash } from 'crypto';

/** Header con la llave del bot. Lo lee el guard y también el límite de peticiones. */
export const BOT_KEY_HEADER = 'x-botbite-key';

/**
 * Tope por IP en las rutas del bot. Frena a quien inventa llaves; el límite que
 * importa es el de cada llave (`THROTTLE_BOT_LIMIT`).
 */
export const BOT_IP_LIMIT = 10_000;

interface RequestWithHeaders {
  headers?: Record<string, unknown>;
}

export const botKeyOf = (request: RequestWithHeaders): string | null => {
  const value = request.headers?.[BOT_KEY_HEADER];
  return typeof value === 'string' && value ? value : null;
};

/**
 * Las peticiones del bot se cuentan por llave y no por IP: el servicio del
 * mesero atiende a todos los negocios desde la misma IP. Se usa un hash para no
 * guardar la llave en memoria.
 */
export const botKeyTracker = (key: string): string =>
  `bot-key:${createHash('sha256').update(key).digest('hex').slice(0, 32)}`;
