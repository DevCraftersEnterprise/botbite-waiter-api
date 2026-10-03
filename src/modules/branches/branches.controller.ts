import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Lang } from '@/common/decorators/lang.decorator';
import {
  assertFileContent,
  uploadOptions,
} from '@/common/uploads/upload-options';
import { AccessControlService } from '@/core/access/access-control.service';
import { Auth } from '@/core/auth/decorators/auth.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import { UserRoles } from '@/core/auth/enums/user-roles.enum';
import { BranchesService } from '@/modules/branches/branches.service';
import { CreateBranchDto } from '@/modules/branches/dto/create-branch.dto';
import { FindBranchDto } from '@/modules/branches/dto/find-branch.dto';
import { UpdateBranchDto } from '@/modules/branches/dto/update-branch.dto';
import { User } from '@/modules/users/entities/user.entity';

@Controller('branches')
export class BranchesController {
  constructor(
    private readonly branchesService: BranchesService,
    private readonly accessControl: AccessControlService,
  ) {}

  @Post(':restaurantId')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT])
  async createBranch(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Body() createBranchDto: CreateBranchDto,
    @CurrentUser() user: User,
    @Lang() lang: string,
  ) {
    await this.accessControl.assertRestaurantAccess(user, restaurantId);
    return this.branchesService.create(
      restaurantId,
      createBranchDto,
      user,
      lang,
    );
  }

  @Post('bulk-upload/:restaurantId')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT])
  @UseInterceptors(FileInterceptor('file', uploadOptions('csv')))
  async bulkCreate(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
    @Lang() lang: string,
  ) {
    await this.accessControl.assertRestaurantAccess(user, restaurantId);
    return this.branchesService.bulkCreateBranches(
      restaurantId,
      assertFileContent(file, 'csv'),
      lang,
    );
  }

  @Get('restaurant/:restaurantId/:term')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT])
  async findByTerm(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('term') term: string,
    @CurrentUser() user: User,
    @Lang() lang: string,
  ) {
    await this.accessControl.assertRestaurantAccess(user, restaurantId);
    return this.branchesService.findByTerm(term, lang, restaurantId);
  }

  @Get('restaurant/:restaurantId')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT])
  async findAllByRestaurant(
    @Query() findBranchesDto: FindBranchDto,
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @CurrentUser() user: User,
  ) {
    await this.accessControl.assertRestaurantAccess(user, restaurantId);
    const { limit, offset, ...searchFilters } = findBranchesDto;
    return this.branchesService.findAllByRestaurant(
      restaurantId,
      { limit, offset },
      searchFilters,
    );
  }

  @Get('generate-qr/:restaurantId/:branchId')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT])
  async generateQr(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @CurrentUser() user: User,
    @Lang() lang: string,
  ) {
    await this.accessControl.assertBranchInRestaurant(
      user,
      restaurantId,
      branchId,
    );
    return this.branchesService.generateQrForBranch(
      branchId,
      restaurantId,
      lang,
    );
  }

  @Patch('restaurant/:restaurantId/:branchId')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT])
  async updateBranch(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Body() updateBranchDto: UpdateBranchDto,
    @CurrentUser() user: User,
    @Lang() lang: string,
  ) {
    await this.accessControl.assertBranchInRestaurant(
      user,
      restaurantId,
      branchId,
    );
    return this.branchesService.update(
      branchId,
      restaurantId,
      updateBranchDto,
      user,
      lang,
    );
  }

  @Patch('activate/:restaurantId/:branchId')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN])
  activateBranch(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @CurrentUser() user: User,
    @Lang() lang: string,
  ) {
    return this.branchesService.activateBranch(
      branchId,
      restaurantId,
      user,
      lang,
    );
  }

  @Delete(':restaurantId/:branchId')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN])
  deactivateBranch(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @CurrentUser() user: User,
    @Lang() lang: string,
  ) {
    return this.branchesService.deactivateBranch(
      branchId,
      restaurantId,
      user,
      lang,
    );
  }
}
