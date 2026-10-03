import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TranslationService } from '@/common/services/translation.service';
import { Branch } from '@/modules/branches/entities/branch.entity';
import { BranchResponse } from '@/modules/branches/interfaces/branches.interfaces';
import { FindOneBranchUseCase } from '@/modules/branches/use-cases/find-one-branch.usecase';
import { User } from '@/modules/users/entities/user.entity';

/** Solo SUPER/ADMIN llegan aquí (lo restringe el controlador). */
@Injectable()
export class ChangeBranchStatusUseCase {
  private readonly logger = new Logger(ChangeBranchStatusUseCase.name);

  constructor(
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    private readonly translationService: TranslationService,
    private readonly findOneBranchUseCase: FindOneBranchUseCase,
  ) {}

  async execute(
    branchId: string,
    restaurantId: string,
    user: User,
    lang: string,
    status: boolean,
  ): Promise<BranchResponse> {
    const { branch } = await this.findOneBranchUseCase.execute(
      branchId,
      lang,
      restaurantId,
    );

    if (branch.isActive === status) {
      throw new BadRequestException(
        this.translationService.translate(
          status
            ? 'branches.branch_already_active'
            : 'branches.branch_already_inactive',
          lang,
        ),
      );
    }

    await this.branchRepository.update({ id: branch.id }, { isActive: status });
    branch.isActive = status;

    this.logger.log(
      `Branch status changed to ${status}: ${branch.id} by user: ${user.id}`,
    );

    return {
      branch,
      message: this.translationService.translate(
        status ? 'branches.branch_activated' : 'branches.branch_deactivated',
        lang,
      ),
    };
  }
}
