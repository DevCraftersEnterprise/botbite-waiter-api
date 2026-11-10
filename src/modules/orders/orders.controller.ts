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
import { FindBillingDto } from '@/modules/orders/dto/find-billing.dto';
import { OpenTabDto } from '@/modules/orders/dto/open-tab.dto';
import { UpdateFulfillmentDto } from '@/modules/orders/dto/update-fulfillment.dto';
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

  /** Pagos en línea y facturas del día, en la zona horaria de la sucursal. */
  @Get('billing')
  @Auth(ORDER_ROLES)
  async billing(
    @Query() { branchId, date }: FindBillingDto,
    @CurrentUser() user: User,
  ) {
    await this.accessControl.assertBranchAccess(user, branchId, 'branch');
    return this.ordersService.billing(branchId, date);
  }

  /** Pedidos de recoger y domicilio pagados que faltan por entregar. */
  @Get('to-deliver')
  @Auth(ORDER_ROLES)
  async findToDeliver(
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @CurrentUser() user: User,
  ) {
    await this.accessControl.assertBranchAccess(user, branchId, 'branch');
    const orders = await this.ordersService.findToDeliver(branchId);
    return {
      orders: orders.map((order) => ({
        ...toOrderView(order),
        // Quien entrega necesita poder llamar al cliente.
        phone: order.customer?.phone ?? null,
      })),
      total: orders.length,
    };
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

  /** Botones de "Para entregar". Se le avisa al bot para que avise al cliente. */
  @Patch(':id/fulfillment')
  @Auth(ORDER_ROLES)
  async updateFulfillment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFulfillmentDto,
    @CurrentUser() user: User,
  ) {
    await this.accessControl.assertOrderAccess(user, id, 'branch');
    const order = await this.accounts.updateFulfillment(
      { id },
      dto.status,
      'panel',
    );
    return { order: toOrderView(order) };
  }

  /**
   * Cancela un pedido de recoger o domicilio pagado y sin entregar. Solo el
   * dueño o un admin: implica devolver dinero.
   */
  @Post(':id/cancel-paid')
  @HttpCode(HttpStatus.OK)
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT])
  async cancelPaid(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    await this.accessControl.assertOrderAccess(user, id);
    const { order, payment } = await this.accounts.cancelPaidOrder(id);
    return {
      order: toOrderView(order),
      refundAmount: payment ? Number(payment.paidAmount) : 0,
      providerPaymentId: payment?.providerPaymentId ?? null,
    };
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
