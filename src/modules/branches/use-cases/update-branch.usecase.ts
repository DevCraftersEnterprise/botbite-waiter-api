import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TranslationService } from '@/common/services/translation.service';
import { UpdateBranchDto } from '@/modules/branches/dto/update-branch.dto';
import { Branch } from '@/modules/branches/entities/branch.entity';
import { BranchResponse } from '@/modules/branches/interfaces/branches.interfaces';
import { FindOneBranchUseCase } from '@/modules/branches/use-cases/find-one-branch.usecase';
import { assertBranchChangesUtil } from '@/modules/branches/utils/assert-branch-changes.util';
import { User } from '@/modules/users/entities/user.entity';

@Injectable()
export class UpdateBranchUseCase {
  private readonly logger = new Logger(UpdateBranchUseCase.name);

  constructor(
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    private readonly translationService: TranslationService,
    private readonly findOneBranchUseCase: FindOneBranchUseCase,
  ) {}

  /** La pertenencia de la sucursal al usuario se valida en el controlador. */
  async execute(
    branchId: string,
    restaurantId: string,
    updateBranchDto: UpdateBranchDto,
    user: User,
    lang: string,
  ): Promise<BranchResponse> {
    await assertBranchChangesUtil(
      user,
      updateBranchDto,
      this.branchRepository,
      branchId,
    );

    const { availableMessages, ...changes } = updateBranchDto;
    const updates: Partial<Branch> = { ...changes };

    // Si se quita el número del asistente, el QR deja de servir.
    if (changes.phoneNumberAssistant === null) {
      updates.qrUrl = null;
      updates.qrToken = null;
    }

    await this.branchRepository.manager.transaction(async (manager) => {
      if (Object.keys(updates).length > 0) {
        await manager.update(Branch, { id: branchId }, updates);
      }

      // Los créditos se SUMAN de forma atómica para no perder mensajes
      // consumidos en paralelo por el webhook.
      if (availableMessages !== undefined) {
        await manager.increment(
          Branch,
          { id: branchId },
          'availableMessages',
          availableMessages,
        );
      }
    });

    const { branch } = await this.findOneBranchUseCase.execute(
      branchId,
      lang,
      restaurantId,
    );

    this.logger.log(
      `Branch updated: ${branch.id} by user: ${user.id}` +
        (availableMessages !== undefined
          ? ` (+${availableMessages} messages, now ${branch.availableMessages})`
          : ''),
    );

    return {
      branch,
      message: this.translationService.translate(
        'branches.branch_updated',
        lang,
      ),
    };
  }
}
