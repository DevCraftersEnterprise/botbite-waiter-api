import { Module } from '@nestjs/common';
import { BranchesService } from '@/modules/branches/branches.service';
import { BranchesController } from '@/modules/branches/branches.controller';
import { Branch } from '@/modules/branches/entities/branch.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from '@/common/common.module';
import { CreateBranchUseCase } from '@/modules/branches/use-cases/create-branch.usecase';
import { BulkCreateBranchesUseCase } from '@/modules/branches/use-cases/bulk-create-branches.usecase';
import { UpdateBranchUseCase } from '@/modules/branches/use-cases/update-branch.usecase';
import { FindOneBranchUseCase } from '@/modules/branches/use-cases/find-one-branch.usecase';
import { ChangeBranchStatusUseCase } from '@/modules/branches/use-cases/change-branch-status.usecase';
import { FindAllBranchesByRestaurantUseCase } from '@/modules/branches/use-cases/find-all-branches-by-restaurant.usecase';
import { GenerateQrForBranchUseCase } from '@/modules/branches/use-cases/generate-qr-for-branch.usecase';

@Module({
  controllers: [BranchesController],
  providers: [
    BranchesService,
    CreateBranchUseCase,
    BulkCreateBranchesUseCase,
    UpdateBranchUseCase,
    FindOneBranchUseCase,
    ChangeBranchStatusUseCase,
    FindAllBranchesByRestaurantUseCase,
    GenerateQrForBranchUseCase,
  ],
  imports: [TypeOrmModule.forFeature([Branch]), CommonModule],
  exports: [TypeOrmModule, BranchesService, FindOneBranchUseCase],
})
export class BranchesModule {}
