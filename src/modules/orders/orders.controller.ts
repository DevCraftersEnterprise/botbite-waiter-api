import {
  Body,
  Controller,
  Get,
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
import { CreateOrderItemDto } from '@/modules/orders/dto/create-order-item.dto';
import { CreateOrderDto } from '@/modules/orders/dto/create-order.dto';
import { UpdateOrderDto } from '@/modules/orders/dto/update-order.dto';
import { OrdersService } from '@/modules/orders/orders.service';
import { User } from '@/modules/users/entities/user.entity';

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly accessControl: AccessControlService,
  ) {}

  @Post()
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT])
  async create(
    @Body() dto: CreateOrderDto,
    @CurrentUser() user: User,
    @Lang() lang: string,
  ) {
    await this.accessControl.assertBranchAccess(user, dto.branchId);
    return this.ordersService.createOrder(dto, lang);
  }

  @Get()
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.USER, UserRoles.CLIENT])
  async findAll(
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @CurrentUser() user: User,
    @Lang() lang: string,
  ) {
    await this.accessControl.assertBranchAccess(user, branchId);
    return this.ordersService.findAllOrders(branchId, lang);
  }

  @Get(':id')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT])
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Lang() lang: string,
  ) {
    await this.accessControl.assertOrderAccess(user, id);
    return this.ordersService.findOneOrder(id, lang);
  }

  @Patch(':id')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN])
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderDto,
    @Lang() lang: string,
  ) {
    return this.ordersService.updateOrder(id, dto, lang);
  }

  // OrderItems
  @Post(':orderId/items')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT])
  async addOrderItem(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: CreateOrderItemDto,
    @CurrentUser() user: User,
    @Lang() lang: string,
  ) {
    await this.accessControl.assertOrderAccess(user, orderId);
    return this.ordersService.addOrderItem(orderId, dto, lang);
  }
}
