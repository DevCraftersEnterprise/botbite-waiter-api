import { join } from 'path';
import * as QRCode from 'qrcode';
import sharp from 'sharp';

export const createQr = async (
  url: string,
): Promise<Buffer<ArrayBufferLike>> => {
  const qrSize = 500;
  const logoSize = 120;

  // 1. Generar QR
  const qrBuffer = await QRCode.toBuffer(url, {
    errorCorrectionLevel: 'H',
    type: 'png',
    scale: 10,
    width: qrSize,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
  });

  // 2. Cargar logo con padding blanco
  const logoPath = join(__dirname, '..', '..', '..', 'assets', 'logo.jpeg');
  const logoPadded = await sharp(logoPath)
    .resize(logoSize - 20, logoSize - 20, {
      fit: 'contain',
      background: '#FFFFFF',
    })
    .extend({
      top: 10,
      bottom: 10,
      left: 10,
      right: 10,
      background: '#FFFFFF',
    })
    .png()
    .toBuffer();

  // 3. Centrado
  const top = Math.floor((qrSize - logoSize) / 2);
  const left = Math.floor((qrSize - logoSize) / 2);

  // 4. Composición
  const finalImage = await sharp(qrBuffer)
    .composite([{ input: logoPadded, top, left }])
    .png()
    .toBuffer();

  return finalImage;
};
