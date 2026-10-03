import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { extname } from 'path';

interface UploadRule {
  maxBytes: number;
  mimeTypes: string[];
  extensions: string[];
}

const RULES = {
  csv: {
    maxBytes: 2 * 1024 * 1024,
    mimeTypes: [
      'text/csv',
      'application/vnd.ms-excel',
      'text/plain',
      'application/csv',
    ],
    extensions: ['.csv'],
  },
  image: {
    maxBytes: 5 * 1024 * 1024,
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    extensions: ['.jpg', '.jpeg', '.png', '.webp'],
  },
  pdf: {
    maxBytes: 10 * 1024 * 1024,
    mimeTypes: ['application/pdf'],
    extensions: ['.pdf'],
  },
} satisfies Record<string, UploadRule>;

export type UploadKind = keyof typeof RULES;

/**
 * Opciones de Multer con límite de tamaño y filtro por tipo. Sin esto, Multer
 * acepta archivos de cualquier tamaño en memoria.
 */
export const uploadOptions = (kind: UploadKind): MulterOptions => {
  const rule: UploadRule = RULES[kind];

  return {
    limits: { fileSize: rule.maxBytes, files: 1 },
    fileFilter: (_req, file, callback) => {
      const extension = extname(file.originalname ?? '').toLowerCase();

      if (
        !rule.mimeTypes.includes(file.mimetype) ||
        !rule.extensions.includes(extension)
      ) {
        return callback(
          new BadRequestException(
            `Invalid file type. Allowed: ${rule.extensions.join(', ')}`,
          ),
          false,
        );
      }

      callback(null, true);
    },
  };
};

const startsWith = (buffer: Buffer, signature: number[], offset = 0) =>
  buffer.length >= offset + signature.length &&
  signature.every((byte, i) => buffer[offset + i] === byte);

/**
 * El mimetype lo declara el cliente; esto comprueba el contenido real.
 */
export const assertFileContent = (
  file: Express.Multer.File | undefined,
  kind: UploadKind,
): Express.Multer.File => {
  if (!file?.buffer?.length) throw new BadRequestException('File is required');

  const { buffer } = file;
  let valid: boolean;

  switch (kind) {
    case 'pdf':
      valid = startsWith(buffer, [0x25, 0x50, 0x44, 0x46]); // %PDF
      break;
    case 'image':
      valid =
        startsWith(buffer, [0xff, 0xd8, 0xff]) || // JPEG
        startsWith(buffer, [0x89, 0x50, 0x4e, 0x47]) || // PNG
        (startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) &&
          startsWith(buffer, [0x57, 0x45, 0x42, 0x50], 8)); // WEBP
      break;
    case 'csv':
      // Texto plano: sin bytes nulos.
      valid = !buffer.subarray(0, 4096).includes(0);
      break;
  }

  if (!valid)
    throw new BadRequestException('File content does not match its type');

  return file;
};
