import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { AccessControlService } from '@/core/access/access-control.service';
import { Auth } from '@/core/auth/decorators/auth.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import { UserRoles } from '@/core/auth/enums/user-roles.enum';
import { FindNotificationsDto } from '@/modules/notifications/dto/find-notifications.dto';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { User } from '@/modules/users/entities/user.entity';

/**
 * Rutas anteriores del panel, para que siga funcionando mientras se despliega.
 * `conversations` responde vacío porque ya no hay bot en la API: la pantalla de
 * Órdenes usará las cuentas nuevas. Se borra cuando el panel deje de llamarlas.
 */
@Controller('messages')
export class LegacyMessagesController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly accessControl: AccessControlService,
  ) {}

  @Get('conversations')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT, UserRoles.USER])
  async getConversationsByBranch(
    @Query() query: FindNotificationsDto,
    @CurrentUser() user: User,
  ) {
    await this.accessControl.assertBranchAccess(user, query.branchId, 'branch');
    return { conversations: [], total: 0 };
  }

  @Get('notifications')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT, UserRoles.USER])
  async getNotificationsByBranch(
    @Query() query: FindNotificationsDto,
    @CurrentUser() user: User,
  ) {
    await this.accessControl.assertBranchAccess(user, query.branchId, 'branch');
    return this.notificationsService.findByBranch(query.branchId);
  }

  @Patch(':notificationId/read')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT, UserRoles.USER])
  async markNotificationAsRead(
    @Param('notificationId', ParseUUIDPipe) notificationId: string,
    @CurrentUser() user: User,
  ) {
    await this.accessControl.assertNotificationAccess(
      user,
      notificationId,
      'branch',
    );
    await this.notificationsService.markAsRead(notificationId);
  }

  @Patch(':notificationId/unread')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT, UserRoles.USER])
  async markNotificationAsUnread(
    @Param('notificationId', ParseUUIDPipe) notificationId: string,
    @CurrentUser() user: User,
  ) {
    await this.accessControl.assertNotificationAccess(
      user,
      notificationId,
      'branch',
    );
    await this.notificationsService.markAsUnread(notificationId);
  }
}
