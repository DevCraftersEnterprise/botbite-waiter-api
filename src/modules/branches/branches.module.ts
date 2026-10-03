import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from '@/common/common.module';
import { BranchesController } from '@/modules/branches/branches.controller';
import { BranchesService } from '@/modules/branches/branches.service';
import { BranchStaff } from '@/modules/branches/entities/branch-staff.entity';
import { Branch } from '@/modules/branches/entities/branch.entity';
import { BranchStaffService } from '@/modules/branches/services/branch-staff.service';
import { BulkCreateBranchesUseCase } from '@/modules/branches/use-cases/bulk-create-branches.usecase';
import { ChangeBranchStatusUseCase } from '@/modules/branches/use-cases/change-branch-status.usecase';
import { CreateBranchUseCase } from '@/modules/branches/use-cases/create-branch.usecase';
import { FindAllBranchesByRestaurantUseCase } from '@/modules/branches/use-cases/find-all-branches-by-restaurant.usecase';
import { FindOneBranchUseCase } from '@/modules/branches/use-cases/find-one-branch.usecase';
import { GenerateQrForBranchUseCase } from '@/modules/branches/use-cases/generate-qr-for-branch.usecase';
import { UpdateBranchUseCase } from '@/modules/branches/use-cases/update-branch.usecase';
import { User } from '@/modules/users/entities/user.entity';

@Module({
  controllers: [BranchesController],
  providers: [
    BranchesService,
    BranchStaffService,
    CreateBranchUseCase,
    BulkCreateBranchesUseCase,
    UpdateBranchUseCase,
    FindOneBranchUseCase,
    ChangeBranchStatusUseCase,
    FindAllBranchesByRestaurantUseCase,
    GenerateQrForBranchUseCase,
  ],
  imports: [
    TypeOrmModule.forFeature([Branch, BranchStaff, User]),
    CommonModule,
  ],
  exports: [TypeOrmModule, BranchesService, FindOneBranchUseCase],
})
export class BranchesModule {}
