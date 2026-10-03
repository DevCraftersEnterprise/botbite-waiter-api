import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TranslationService } from '@/common/services/translation.service';
import { CreateBranchDto } from '@/modules/branches/dto/create-branch.dto';
import { Branch } from '@/modules/branches/entities/branch.entity';
import { BranchResponse } from '@/modules/branches/interfaces/branches.interfaces';
import { assertBranchChangesUtil } from '@/modules/branches/utils/assert-branch-changes.util';
import { User } from '@/modules/users/entities/user.entity';

@Injectable()
export class CreateBranchUseCase {
  private readonly logger = new Logger(CreateBranchUseCase.name);

  constructor(
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    private readonly translationService: TranslationService,
  ) {}

  async execute(
    restaurantId: string,
    createBranchDto: CreateBranchDto,
    user: User,
    lang: string,
  ): Promise<BranchResponse> {
    await assertBranchChangesUtil(user, createBranchDto, this.branchRepository);

    const newBranch = this.branchRepository.create({
      ...createBranchDto,
      restaurantId,
    });

    await this.branchRepository.save(newBranch);

    this.logger.log(
      `Branch created with ID: ${newBranch.id} for restaurant ID: ${restaurantId}`,
    );

    return {
      branch: newBranch,
      message: this.translationService.translate(
        'branches.branch_created',
        lang,
      ),
    };
  }
}
