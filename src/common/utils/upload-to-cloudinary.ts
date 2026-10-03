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

export const cloudinaryFolder = (path: string) =>
  process.env.NODE_ENV === 'production'
    ? `botbite/${path}`
    : `dev/botbite/${path}`;
