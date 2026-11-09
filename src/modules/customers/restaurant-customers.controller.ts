import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { AccessControlService } from '@/core/access/access-control.service';
import { Auth } from '@/core/auth/decorators/auth.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import { UserRoles } from '@/core/auth/enums/user-roles.enum';
import { FindRestaurantCustomersDto } from '@/modules/customers/dto/find-restaurant-customers.dto';
import { CustomerReportService } from '@/modules/customers/services/customer-report.service';
import { User } from '@/modules/users/entities/user.entity';

/**
 * Pantalla Clientes. La ven el dueño y los administradores de BotBite; el
 * personal no, porque trae teléfonos y consumo.
 */
const CUSTOMER_REPORT_ROLES = [
  UserRoles.SUPER,
  UserRoles.ADMIN,
  UserRoles.CLIENT,
];

@Controller('restaurants/:restaurantId/customers')
export class RestaurantCustomersController {
  constructor(
    private readonly report: CustomerReportService,
    private readonly accessControl: AccessControlService,
  ) {}

  @Get()
  @Auth(CUSTOMER_REPORT_ROLES)
  async list(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Query() query: FindRestaurantCustomersDto,
    @CurrentUser() user: User,
  ) {
    await this.accessControl.assertRestaurantAccess(user, restaurantId);
    return this.report.list(restaurantId, query);
  }

  @Get('export')
  @Auth(CUSTOMER_REPORT_ROLES)
  async export(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Query() query: FindRestaurantCustomersDto,
    @CurrentUser() user: User,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.accessControl.assertRestaurantAccess(user, restaurantId);
    const { fileName, content } = await this.report.export(
      restaurantId,
      query,
      user.id,
    );

    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    });
    return new StreamableFile(Buffer.from(content, 'utf8'));
  }

  /** El teléfono completo: es un POST porque queda registrado. */
  @Post(':id/phone')
  @HttpCode(200)
  @Auth(CUSTOMER_REPORT_ROLES)
  async revealPhone(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    await this.accessControl.assertRestaurantAccess(user, restaurantId);
    return this.report.revealPhone(restaurantId, id, user.id);
  }
}
