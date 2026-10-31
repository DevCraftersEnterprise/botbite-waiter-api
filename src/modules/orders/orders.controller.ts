import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Lang } from '@/common/decorators/lang.decorator';
import { AccessControlService } from '@/core/access/access-control.service';
import { Auth } from '@/core/auth/decorators/auth.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import { UserRoles } from '@/core/auth/enums/user-roles.enum';
import { AddRoundDto } from '@/modules/orders/dto/add-round.dto';
import { OpenTabDto } from '@/modules/orders/dto/open-tab.dto';
import { UpdateRoundStatusDto } from '@/modules/orders/dto/update-round-status.dto';
import { OrdersService } from '@/modules/orders/orders.service';
import { OrderAccountsService } from '@/modules/orders/services/order-accounts.service';
import {
  toOrderView,
  toRoundView,
} from '@/modules/orders/utils/order-view.util';
import { User } from '@/modules/users/entities/user.entity';

const ORDER_ROLES = [
  UserRoles.SUPER,
  UserRoles.ADMIN,
  UserRoles.CLIENT,
  UserRoles.USER,
];

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly accounts: OrderAccountsService,
    private readonly accessControl: AccessControlService,
  ) {}

  @Get()
  @Auth(ORDER_ROLES)
  async findAll(
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @CurrentUser() user: User,
    @Lang() lang: string,
  ) {
    await this.accessControl.assertBranchAccess(user, branchId, 'branch');
    return this.ordersService.findAllOrders(branchId, lang);
  }

  /** Cuentas en curso de la sucursal, con sus rondas. */
  @Get('active')
  @Auth(ORDER_ROLES)
  async findActive(
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @CurrentUser() user: User,
  ) {
    await this.accessControl.assertBranchAccess(user, branchId, 'branch');
    const orders = await this.ordersService.findActive(branchId);
    return { orders: orders.map(toOrderView), total: orders.length };
  }

  /** Indicadores del día, en la zona horaria de la sucursal. */
  @Get('summary')
  @Auth(ORDER_ROLES)
  async summary(
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @CurrentUser() user: User,
  ) {
    await this.accessControl.assertBranchAccess(user, branchId, 'branch');
    return this.ordersService.summary(branchId);
  }

  @Post('tabs')
  @Auth(ORDER_ROLES)
  async openTab(@Body() dto: OpenTabDto, @CurrentUser() user: User) {
    await this.accessControl.assertBranchAccess(user, dto.branchId, 'branch');
    const { order, round } = await this.accounts.openStaffTab(dto);
    return { order: toOrderView(order), round: toRoundView(round) };
  }

  @Patch('rounds/:roundId')
  @Auth(ORDER_ROLES)
  async updateRoundStatus(
    @Param('roundId', ParseUUIDPipe) roundId: string,
    @Body() dto: UpdateRoundStatusDto,
    @CurrentUser() user: User,
  ) {
    await this.accessControl.assertRoundAccess(user, roundId, 'branch');
    const round = await this.accounts.updateRoundStatus(roundId, dto.status);
    return { round: toRoundView(round) };
  }

  @Get(':id')
  @Auth(ORDER_ROLES)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Lang() lang: string,
  ) {
    await this.accessControl.assertOrderAccess(user, id, 'branch');
    return this.ordersService.findOneOrder(id, lang);
  }

  @Post(':id/rounds')
  @Auth(ORDER_ROLES)
  async addRound(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddRoundDto,
    @CurrentUser() user: User,
  ) {
    await this.accessControl.assertOrderAccess(user, id, 'branch');
    const { order, round } = await this.accounts.addStaffRound(id, dto.items);
    return { order: toOrderView(order), round: toRoundView(round) };
  }

  @Post(':id/settle')
  @HttpCode(HttpStatus.OK)
  @Auth(ORDER_ROLES)
  async settle(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    await this.accessControl.assertOrderAccess(user, id, 'branch');
    return { order: toOrderView(await this.accounts.settle(id)) };
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Auth(ORDER_ROLES)
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    await this.accessControl.assertOrderAccess(user, id, 'branch');
    return { order: toOrderView(await this.accounts.cancel(id)) };
  }
}
