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
      updateBranchDto,
      this.branchRepository,
      branchId,
    );

    if (Object.keys(updateBranchDto).length > 0) {
      await this.branchRepository.update({ id: branchId }, updateBranchDto);
    }

    const { branch } = await this.findOneBranchUseCase.execute(
      branchId,
      lang,
      restaurantId,
    );

    this.logger.log(`Branch updated: ${branch.id} by user: ${user.id}`);

    return {
      branch,
      message: this.translationService.translate(
        'branches.branch_updated',
        lang,
      ),
    };
  }
}
