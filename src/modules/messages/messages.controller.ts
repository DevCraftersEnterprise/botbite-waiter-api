import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AccessControlService } from '@/core/access/access-control.service';
import { Auth } from '@/core/auth/decorators/auth.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import { UserRoles } from '@/core/auth/enums/user-roles.enum';
import { FindConversationsByBranchDto } from '@/modules/messages/dto/find-conversations-by-branch.dto';
import { TwilioSignatureGuard } from '@/modules/messages/guards/twilio-signature.guard';
import { ConversationsListResponse } from '@/modules/messages/interfaces/messages.interfaces';
import { WebhookDataTwilio } from '@/modules/messages/models/webhook-data.twilio';
import { ParseTwilioWebhookPipe } from '@/modules/messages/pipes/parse-twilio-webhook.pipe';
import { ConversationService } from '@/modules/messages/services/conversation.service';
import { InboundMessageQueueService } from '@/modules/messages/services/inbound-message-queue.service';
import { User } from '@/modules/users/entities/user.entity';

const EMPTY_TWIML =
  '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

@Controller('messages')
export class MessagesController {
  constructor(
    private readonly conversationService: ConversationService,
    private readonly inboundQueue: InboundMessageQueueService,
    private readonly accessControl: AccessControlService,
  ) {}

  /**
   * Webhook de WhatsApp (Twilio). Valida la firma, encola el mensaje y
   * responde de inmediato con TwiML vacío; las respuestas al cliente se envían
   * después por la API de Twilio.
   */
  @Post('webhook')
  @SkipThrottle()
  @UseGuards(TwilioSignatureGuard)
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'text/xml')
  async handleTwilioWebhook(
    @Body(ParseTwilioWebhookPipe) body: Record<string, unknown>,
  ) {
    const result = await this.inboundQueue.enqueue(
      body as unknown as WebhookDataTwilio,
    );

    // 503 hace que Twilio reintente más tarde.
    if (result === 'overloaded') throw new ServiceUnavailableException();

    return EMPTY_TWIML;
  }

  @Get('conversations')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT, UserRoles.USER])
  async getConversationsByBranch(
    @Query() query: FindConversationsByBranchDto,
    @CurrentUser() user: User,
  ): Promise<ConversationsListResponse> {
    await this.accessControl.assertBranchAccess(user, query.branchId, 'branch');
    return this.conversationService.findByBranch(query.branchId);
  }

  @Get('notifications')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT, UserRoles.USER])
  async getNotificationsByBranch(
    @Query() query: FindConversationsByBranchDto,
    @CurrentUser() user: User,
  ) {
    await this.accessControl.assertBranchAccess(user, query.branchId, 'branch');
    return this.conversationService.getNotificationsByBranch(query.branchId);
  }

  // El personal de caja marca las notificaciones como atendidas.
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
    await this.conversationService.markNotificationAsRead(notificationId);
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
    await this.conversationService.markNotificationAsUnread(notificationId);
  }
}
