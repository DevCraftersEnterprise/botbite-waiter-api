import { Injectable } from '@nestjs/common';
import {
  cloudinaryFolder,
  isOwnCloudinaryUrl,
  uploadRemotePictureToCloudinary,
} from '@/common/utils/upload-to-cloudinary';

/** Fotos del CSV del menú. Separado para poder reemplazarlo en las pruebas. */
@Injectable()
export class MenuPhotoService {
  /** Una URL que ya es de BotBite (p. ej. de una exportación) no se vuelve a subir. */
  isOwnUrl(url: string): boolean {
    return isOwnCloudinaryUrl(url);
  }

  /** Copia la foto a la carpeta del producto y devuelve la URL nueva. */
  copy(url: string, restaurantId: string, productId: string): Promise<string> {
    return uploadRemotePictureToCloudinary(
      url,
      cloudinaryFolder(`products/${restaurantId}`),
      `product-${productId}`,
    );
  }
}
