import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from '@/common/common.module';
import { BranchesModule } from '@/modules/branches/branches.module';
import { Customer } from '@/modules/customers/entities/customer.entity';
import { CashierNotification } from '@/modules/messages/entities/cashier-notifications.entity';
import { ConversationMessage } from '@/modules/messages/entities/conversation-message.entity';
import { Conversation } from '@/modules/messages/entities/conversation.entity';
import { ProcessedMessage } from '@/modules/messages/entities/processed-message.entity';
import { OrdersGateway } from '@/modules/messages/gateways/orders.gateway';
import { TwilioSignatureGuard } from '@/modules/messages/guards/twilio-signature.guard';
import { MessagesController } from '@/modules/messages/messages.controller';
import { ConversationCleanupService } from '@/modules/messages/services/conversation-cleanup.service';
import { ConversationService } from '@/modules/messages/services/conversation.service';
import { InboundMessageQueueService } from '@/modules/messages/services/inbound-message-queue.service';
import { TwilioService } from '@/modules/messages/services/twilio.service';
import { CleanupOldConversationsUseCase } from '@/modules/messages/use-cases/conversations/cleanup-old-conversations.usecase';
import { DeleteConversationUseCase } from '@/modules/messages/use-cases/conversations/delete-conversation.usecase';
import { FindConversationsByBranchUseCase } from '@/modules/messages/use-cases/conversations/find-conversations-by-branch.usecase';
import { GetOrCreateConversationUseCase } from '@/modules/messages/use-cases/conversations/get-create-conversation.usecase';
import { CreateOrderAfterBillRequestUseCase } from '@/modules/messages/use-cases/messages/create-order-after-bill-request.usecase';
import { NotifyCashierAboutInappropriateBehaviorUseCase } from '@/modules/messages/use-cases/messages/notifications/notify-cashier-about-inappropriate-behavior.usecase';
import { ProcessIncomingMessageUseCase } from '@/modules/messages/use-cases/messages/process-incoming-message.usecase';
import { ProcessMainFlowUseCase } from '@/modules/messages/use-cases/messages/process-main-flow.usecase';
import { ProcessMessageUseCase } from '@/modules/messages/use-cases/messages/process-message.usecase';
import { SendMessageUseCase } from '@/modules/messages/use-cases/messages/send-message.usecase';
import { ProcessIncomingWhatsappMessageUseCase } from '@/modules/messages/use-cases/twilio/process-incoming-whatsapp-message.usecase';
import { SendWhatsappMessageUseCase } from '@/modules/messages/use-cases/twilio/send-whatsapp-message.usecase';
import { OpenAIModule } from '@/modules/openai/openai.module';
import { OrdersModule } from '@/modules/orders/orders.module';
import { User } from '@/modules/users/entities/user.entity';

@Module({
  imports: [
    CommonModule,
    BranchesModule,
    OpenAIModule,
    OrdersModule,
    TypeOrmModule.forFeature([
      Conversation,
      ConversationMessage,
      CashierNotification,
      ProcessedMessage,
      Customer,
      User,
    ]),
  ],
  controllers: [MessagesController],
  providers: [
    // Servicios
    TwilioService,
    ConversationService,
    ConversationCleanupService,
    InboundMessageQueueService,
    // Gateway y guards
    OrdersGateway,
    TwilioSignatureGuard,
    // Casos de uso
    GetOrCreateConversationUseCase,
    ProcessMessageUseCase,
    FindConversationsByBranchUseCase,
    DeleteConversationUseCase,
    ProcessIncomingMessageUseCase,
    ProcessIncomingWhatsappMessageUseCase,
    SendWhatsappMessageUseCase,
    CleanupOldConversationsUseCase,
    NotifyCashierAboutInappropriateBehaviorUseCase,
    SendMessageUseCase,
    CreateOrderAfterBillRequestUseCase,
    ProcessMainFlowUseCase,
  ],
  exports: [TypeOrmModule, TwilioService, ConversationService],
})
export class MessagesModule {}
