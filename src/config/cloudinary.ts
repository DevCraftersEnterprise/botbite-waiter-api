import { v2 as cloudinary } from 'cloudinary';

let configured = false;

/**
 * Devuelve el cliente de Cloudinary configurado. Se configura en el primer uso
 * (y no al importar el módulo) para que las variables de entorno ya estén
 * cargadas por ConfigModule.
 */
export const getCloudinary = () => {
  if (!configured) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    configured = true;
  }

  return cloudinary;
};
