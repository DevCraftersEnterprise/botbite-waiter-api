import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseInterceptors,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { AccessControlService } from '@/core/access/access-control.service';
import { Auth } from '@/core/auth/decorators/auth.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import { UserRoles } from '@/core/auth/enums/user-roles.enum';
import { CatalogChangedInterceptor } from '@/modules/bot-events/catalog-changed.interceptor';
import { UpdateAcceptingDto } from '@/modules/ordering/dto/update-accepting.dto';
import { UpdateOrderingDto } from '@/modules/ordering/dto/update-ordering.dto';
import { OrderingConfigService } from '@/modules/ordering/services/ordering-config.service';
import { User } from '@/modules/users/entities/user.entity';

/**
 * Ajustes del modo pedidos de una sucursal. Al guardar se avisa al bot
 * (`catalog.changed`) para que vuelva a leer `GET /bot/branch`.
 */
@ApiExcludeController()
@Controller('branches/:restaurantId/:branchId/ordering')
export class OrderingAdminController {
  constructor(
    private readonly orderingConfigService: OrderingConfigService,
    private readonly accessControl: AccessControlService,
  ) {}

  /** Caja también lo lee: necesita saber si se están recibiendo pedidos. */
  @Get()
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT, UserRoles.USER])
  async find(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @CurrentUser() user: User,
  ) {
    await this.accessControl.assertBranchInRestaurant(
      user,
      restaurantId,
      branchId,
      'branch',
    );
    return { ordering: await this.orderingConfigService.find(branchId) };
  }

  @Patch()
  @UseInterceptors(CatalogChangedInterceptor)
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT])
  async update(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: UpdateOrderingDto,
    @CurrentUser() user: User,
  ) {
    await this.accessControl.assertBranchInRestaurant(
      user,
      restaurantId,
      branchId,
    );
    return {
      ordering: await this.orderingConfigService.update(branchId, dto, user),
    };
  }

  /** "Recibiendo pedidos": lo puede cambiar caja, como *pausar* en WhatsApp. */
  @Patch('accepting')
  @UseInterceptors(CatalogChangedInterceptor)
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT, UserRoles.USER])
  async updateAccepting(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: UpdateAcceptingDto,
    @CurrentUser() user: User,
  ) {
    await this.accessControl.assertBranchInRestaurant(
      user,
      restaurantId,
      branchId,
      'branch',
    );
    return this.orderingConfigService.setAccepting(branchId, dto.accepting);
  }
}
