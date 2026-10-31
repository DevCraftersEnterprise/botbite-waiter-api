import { createHash, randomBytes } from 'crypto';

export interface GeneratedBotKey {
  /** Valor completo: solo se entrega al crearla. */
  secret: string;
  keyPrefix: string;
  keyHash: string;
}

// SHA-256 alcanza porque la llave tiene 256 bits aleatorios: a diferencia de una
// contraseña, no se puede adivinar, y hay que validarla en cada petición.
export const hashBotKey = (key: string): string =>
  createHash('sha256').update(key).digest('hex');

export const generateBotKey = (): GeneratedBotKey => {
  const keyPrefix = `bbk_${randomBytes(4).toString('hex')}`;
  const secret = `${keyPrefix}_${randomBytes(32).toString('base64url')}`;

  return { secret, keyPrefix, keyHash: hashBotKey(secret) };
};
