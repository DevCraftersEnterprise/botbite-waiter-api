import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { AccessControlService } from '@/core/access/access-control.service';
import { Auth } from '@/core/auth/decorators/auth.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import { UserRoles } from '@/core/auth/enums/user-roles.enum';
import { CreateBotKeyDto } from '@/modules/bot/dto/create-bot-key.dto';
import { UpdateBotConfigDto } from '@/modules/bot/dto/update-bot-config.dto';
import { BotConfigService } from '@/modules/bot/services/bot-config.service';
import { BotKeysService } from '@/modules/bot/services/bot-keys.service';
import { User } from '@/modules/users/entities/user.entity';

/** Pantalla "Mesero digital" del panel: configuración y llaves de la sucursal. */
@ApiExcludeController()
@Controller('branches/:restaurantId/:branchId')
export class BotAdminController {
  constructor(
    private readonly botConfigService: BotConfigService,
    private readonly botKeysService: BotKeysService,
    private readonly accessControl: AccessControlService,
  ) {}

  @Get('bot-config')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT])
  async findConfig(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @CurrentUser() user: User,
  ) {
    await this.accessControl.assertBranchInRestaurant(
      user,
      restaurantId,
      branchId,
    );
    return { config: await this.botConfigService.findConfig(branchId) };
  }

  @Patch('bot-config')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT])
  async updateConfig(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: UpdateBotConfigDto,
    @CurrentUser() user: User,
  ) {
    await this.accessControl.assertBranchInRestaurant(
      user,
      restaurantId,
      branchId,
    );
    return {
      config: await this.botConfigService.updateConfig(branchId, dto, user),
    };
  }

  /** Platillos de la sucursal para que el personal abra cuentas. */
  @Get('catalog')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT, UserRoles.USER])
  async findCatalog(
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
    const { catalog } = await this.botConfigService.findBotBranch(branchId);
    return { catalog };
  }

  // Las llaves dan acceso de escritura al bot: solo las administra BotBite.
  @Get('bot-keys')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN])
  async findKeys(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @CurrentUser() user: User,
  ) {
    await this.accessControl.assertBranchInRestaurant(
      user,
      restaurantId,
      branchId,
    );
    return { keys: await this.botKeysService.findByBranch(branchId) };
  }

  @Post('bot-keys')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN])
  async createKey(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: CreateBotKeyDto,
    @CurrentUser() user: User,
  ) {
    await this.accessControl.assertBranchInRestaurant(
      user,
      restaurantId,
      branchId,
    );
    return this.botKeysService.create(branchId, dto.name);
  }

  @Delete('bot-keys/:keyId')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN])
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeKey(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Param('keyId', ParseUUIDPipe) keyId: string,
    @CurrentUser() user: User,
  ) {
    await this.accessControl.assertBranchInRestaurant(
      user,
      restaurantId,
      branchId,
    );
    await this.botKeysService.revoke(branchId, keyId);
  }
}
