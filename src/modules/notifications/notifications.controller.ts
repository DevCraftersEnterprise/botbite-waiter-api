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

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly accessControl: AccessControlService,
  ) {}

  @Get()
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT, UserRoles.USER])
  async findByBranch(
    @Query() query: FindNotificationsDto,
    @CurrentUser() user: User,
  ) {
    await this.accessControl.assertBranchAccess(user, query.branchId, 'branch');
    return this.notificationsService.findByBranch(query.branchId);
  }

  // El personal de caja marca las notificaciones como atendidas.
  @Patch(':notificationId/read')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT, UserRoles.USER])
  async markAsRead(
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
  async markAsUnread(
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
