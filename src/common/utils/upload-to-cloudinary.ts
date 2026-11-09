import { UploadApiOptions } from 'cloudinary';
import { getCloudinary } from '@/config/cloudinary';

const uploadBuffer = (
  buffer: Buffer,
  options: UploadApiOptions,
): Promise<string> =>
  new Promise((resolve, reject) => {
    getCloudinary()
      .uploader.upload_stream(
        { overwrite: true, ...options },
        (error, result) => {
          if (error || !result) {
            return reject(new Error(error?.message || 'Upload failed'));
          }
          resolve(result.secure_url);
        },
      )
      .end(buffer);
  });

export const uploadQRToCloudinary = (
  buffer: Buffer,
  folder: string,
  fileName: string,
) =>
  uploadBuffer(buffer, { folder, public_id: fileName, resource_type: 'image' });

export const uploadPdfToCloudinary = (
  buffer: Buffer,
  folder: string,
  fileName: string,
) =>
  uploadBuffer(buffer, {
    folder,
    public_id: fileName,
    resource_type: 'raw',
    type: 'upload',
    format: 'pdf',
  });

export const uploadPictureToCloudinary = (
  buffer: Buffer,
  folder: string,
  fileName: string,
) =>
  uploadBuffer(buffer, {
    folder,
    public_id: fileName,
    resource_type: 'image',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
  });

/**
 * Logo del restaurante: Cloudinary lo deja cuadrado (512 px) sin recortarlo,
 * con fondo transparente si el formato lo permite.
 */
export const uploadLogoToCloudinary = (
  buffer: Buffer,
  folder: string,
  fileName: string,
) =>
  uploadBuffer(buffer, {
    folder,
    public_id: fileName,
    resource_type: 'image',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [
      { width: 512, height: 512, crop: 'pad', background: 'rgb:ffffff00' },
    ],
  });

/**
 * Copia una imagen pública a Cloudinary. La descarga la hace Cloudinary, no
 * este servidor, así que una URL interna de la red no queda expuesta.
 */
export const uploadRemotePictureToCloudinary = async (
  url: string,
  folder: string,
  fileName: string,
): Promise<string> => {
  const result = await getCloudinary().uploader.upload(url, {
    folder,
    public_id: fileName,
    overwrite: true,
    resource_type: 'image',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    timeout: 30_000,
  });
  return result.secure_url;
};

/** Las imágenes que ya están en la cuenta de Cloudinary de BotBite. */
export const isOwnCloudinaryUrl = (url: string): boolean => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  return (
    !!cloudName && url.startsWith(`https://res.cloudinary.com/${cloudName}/`)
  );
};

export const cloudinaryFolder = (path: string) =>
  process.env.NODE_ENV === 'production'
    ? `botbite/${path}`
    : `dev/botbite/${path}`;
