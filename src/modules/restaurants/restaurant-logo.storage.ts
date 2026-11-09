import { Injectable } from '@nestjs/common';
import {
  cloudinaryFolder,
  uploadLogoToCloudinary,
} from '@/common/utils/upload-to-cloudinary';

/** Dónde se guarda el logo. Separado para poder reemplazarlo en las pruebas. */
@Injectable()
export class RestaurantLogoStorage {
  /** Sube el logo cuadrado y devuelve su URL. Reemplaza al anterior. */
  upload(buffer: Buffer, restaurantId: string): Promise<string> {
    return uploadLogoToCloudinary(
      buffer,
      cloudinaryFolder(`restaurants/${restaurantId}`),
      'logo',
    );
  }
}
