import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { CreateBranchDto } from '@/modules/branches/dto/create-branch.dto';
import { FindBranchDto } from '@/modules/branches/dto/find-branch.dto';
import { UpdateBranchDto } from '@/modules/branches/dto/update-branch.dto';
import { Branch } from '@/modules/branches/entities/branch.entity';
import {
  BranchListResponse,
  BranchResponse,
  BulkCreateBranchesResponse,
} from '@/modules/branches/interfaces/branches.interfaces';
import { BulkCreateBranchesUseCase } from '@/modules/branches/use-cases/bulk-create-branches.usecase';
import { ChangeBranchStatusUseCase } from '@/modules/branches/use-cases/change-branch-status.usecase';
import { CreateBranchUseCase } from '@/modules/branches/use-cases/create-branch.usecase';
import { FindAllBranchesByRestaurantUseCase } from '@/modules/branches/use-cases/find-all-branches-by-restaurant.usecase';
import { FindOneBranchUseCase } from '@/modules/branches/use-cases/find-one-branch.usecase';
import { GenerateQrForBranchUseCase } from '@/modules/branches/use-cases/generate-qr-for-branch.usecase';
import { UpdateBranchUseCase } from '@/modules/branches/use-cases/update-branch.usecase';
import { User } from '@/modules/users/entities/user.entity';

@Injectable()
export class BranchesService {
  constructor(
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    private readonly createBranchUseCase: CreateBranchUseCase,
    private readonly bulkCreateBranchesUseCase: BulkCreateBranchesUseCase,
    private readonly updateBranchUseCase: UpdateBranchUseCase,
    private readonly findOneBranchUseCase: FindOneBranchUseCase,
    private readonly changeBranchStatusUseCase: ChangeBranchStatusUseCase,
    private readonly findAllBranchesByRestaurantUseCase: FindAllBranchesByRestaurantUseCase,
    private readonly generateQrForBranchUseCase: GenerateQrForBranchUseCase,
  ) {}

  create(
    restaurantId: string,
    createBranchDto: CreateBranchDto,
    user: User,
    lang: string,
  ): Promise<BranchResponse> {
    return this.createBranchUseCase.execute(
      restaurantId,
      createBranchDto,
      user,
      lang,
    );
  }

  bulkCreateBranches(
    restaurantId: string,
    file: Express.Multer.File,
    lang: string,
  ): Promise<BulkCreateBranchesResponse> {
    return this.bulkCreateBranchesUseCase.execute(restaurantId, file, lang);
  }

  update(
    branchId: string,
    restaurantId: string,
    updateBranchDto: UpdateBranchDto,
    user: User,
    lang: string,
  ): Promise<BranchResponse> {
    return this.updateBranchUseCase.execute(
      branchId,
      restaurantId,
      updateBranchDto,
      user,
      lang,
    );
  }

  activateBranch(
    branchId: string,
    restaurantId: string,
    user: User,
    lang: string,
  ): Promise<BranchResponse> {
    return this.changeBranchStatusUseCase.execute(
      branchId,
      restaurantId,
      user,
      lang,
      true,
    );
  }

  deactivateBranch(
    branchId: string,
    restaurantId: string,
    user: User,
    lang: string,
  ): Promise<BranchResponse> {
    return this.changeBranchStatusUseCase.execute(
      branchId,
      restaurantId,
      user,
      lang,
      false,
    );
  }

  findByTerm(
    term: string,
    lang: string,
    restaurantId?: string,
  ): Promise<BranchResponse> {
    return this.findOneBranchUseCase.execute(term, lang, restaurantId);
  }

  findAllByRestaurant(
    restaurantId: string,
    paginationDto: PaginationDto = {},
    findBranchDto: FindBranchDto = {},
  ): Promise<BranchListResponse> {
    return this.findAllBranchesByRestaurantUseCase.execute(
      restaurantId,
      paginationDto,
      findBranchDto,
    );
  }

  generateQrForBranch(branchId: string, restaurantId: string, lang: string) {
    return this.generateQrForBranchUseCase.execute(
      branchId,
      restaurantId,
      lang,
    );
  }

  /**
   * Descuenta un crédito de mensaje de forma atómica. Devuelve false si la
   * sucursal ya no tenía saldo (así nunca queda en negativo ni se pierden
   * descuentos con mensajes concurrentes).
   */
  async consumeMessageCredit(branchId: string): Promise<boolean> {
    const result = await this.branchRepository.decrement(
      { id: branchId, availableMessages: MoreThan(0) },
      'availableMessages',
      1,
    );
    return (result.affected ?? 0) > 0;
  }
}
