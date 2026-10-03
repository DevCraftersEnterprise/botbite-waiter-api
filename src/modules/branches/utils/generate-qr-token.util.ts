import { randomBytes } from 'crypto';

/**
 * Token que viaja en el mensaje pre-llenado del QR. En v1 tenía solo 24 bits
 * aleatorios; con 128 bits ya no es adivinable. Mantiene el formato
 * `QR-<timestamp>-<hex>` que reconoce validateQrScanUtil.
 */
export const generateQrToken = (): string =>
  `QR-${Date.now()}-${randomBytes(16).toString('hex')}`;
