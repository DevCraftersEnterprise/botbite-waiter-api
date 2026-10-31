import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import { buildBranchQrUrl } from '@/modules/branches/utils/branch-qr-url.util';

@Injectable()
export class GenerateQrForBranchUseCase {
  private readonly logger = new Logger(GenerateQrForBranchUseCase.name);

  constructor(
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    private readonly findOneBranchUseCase: FindOneBranchUseCase,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Genera el QR de la sucursal. Apunta a una URL fija que redirige a la página
   * del mesero: si el mesero cambia de servidor, el QR impreso sigue sirviendo.
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

    const targetUrl = buildBranchQrUrl(
      this.configService.getOrThrow<string>('app.qrBaseUrl'),
      branch.slug,
    );

    const finalImage = await createQr(targetUrl);
    const uploadedImageUrl = await uploadQRToCloudinary(
      finalImage,
      cloudinaryFolder('branches'),
      `qr-${branch.id}`,
    );

    await this.branchRepository.update(
      { id: branch.id },
      { qrUrl: uploadedImageUrl },
    );

    this.logger.log(`QR code generated for branch ${branch.id}`);

    return { qrUrl: uploadedImageUrl };
  }
}
