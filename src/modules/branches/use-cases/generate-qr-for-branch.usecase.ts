import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createQr } from '@/common/utils/create-qr';
import {
  cloudinaryFolder,
  uploadQRToCloudinary,
} from '@/common/utils/upload-to-cloudinary';
import { Branch } from '@/modules/branches/entities/branch.entity';
import { QrGenerationResponse } from '@/modules/branches/interfaces/branches.interfaces';
import { FindOneBranchUseCase } from '@/modules/branches/use-cases/find-one-branch.usecase';
import { generateQrToken } from '@/modules/branches/utils/generate-qr-token.util';

@Injectable()
export class GenerateQrForBranchUseCase {
  private readonly logger = new Logger(GenerateQrForBranchUseCase.name);

  constructor(
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    private readonly findOneBranchUseCase: FindOneBranchUseCase,
  ) {}

  /**
   * Genera un QR nuevo. Cada generación rota el token: los QR impresos
   * anteriormente dejan de iniciar conversaciones.
   */
  async execute(
    branchId: string,
    restaurantId: string,
    lang: string,
  ): Promise<QrGenerationResponse> {
    const { branch } = await this.findOneBranchUseCase.execute(
      branchId,
      lang,
      restaurantId,
    );

    if (!branch.phoneNumberAssistant) {
      throw new BadRequestException(
        'The branch needs an assistant phone number before generating a QR code',
      );
    }

    const qrToken = generateQrToken();
    const prefilledMessage = `🛡️ INICIO ${qrToken}`;
    const phone = branch.phoneNumberAssistant.replace(/\D/g, '');
    const targetUrl = `https://wa.me/${phone}?text=${encodeURIComponent(prefilledMessage)}`;

    const finalImage = await createQr(targetUrl);
    const uploadedImageUrl = await uploadQRToCloudinary(
      finalImage,
      cloudinaryFolder('branches'),
      `qr-${branch.id}`,
    );

    await this.branchRepository.update(
      { id: branch.id },
      { qrUrl: uploadedImageUrl, qrToken },
    );

    this.logger.log(`QR code generated for branch ${branch.id}`);

    return { qrUrl: uploadedImageUrl };
  }
}
