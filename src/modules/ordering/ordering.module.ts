import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Branch } from '@/modules/branches/entities/branch.entity';
import { BranchOrdering } from '@/modules/ordering/entities/branch-ordering.entity';
import { OrderingAdminController } from '@/modules/ordering/ordering-admin.controller';
import { OrderingConfigService } from '@/modules/ordering/services/ordering-config.service';

@Module({
  imports: [TypeOrmModule.forFeature([BranchOrdering, Branch])],
  controllers: [OrderingAdminController],
  providers: [OrderingConfigService],
  exports: [OrderingConfigService],
})
export class OrderingModule {}
