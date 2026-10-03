import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from '@/modules/branches/entities/branch.entity';
import { Customer } from '@/modules/customers/entities/customer.entity';
import { CashierNotification } from '@/modules/messages/entities/cashier-notifications.entity';
import { Conversation } from '@/modules/messages/entities/conversation.entity';
import { OrdersGateway } from '@/modules/messages/gateways/orders.gateway';
import { ConversationsListResponse } from '@/modules/messages/interfaces/messages.interfaces';
import { DeleteConversationUseCase } from '@/modules/messages/use-cases/conversations/delete-conversation.usecase';
import { FindConversationsByBranchUseCase } from '@/modules/messages/use-cases/conversations/find-conversations-by-branch.usecase';
import { GetOrCreateConversationUseCase } from '@/modules/messages/use-cases/conversations/get-create-conversation.usecase';
import { ProcessMessageUseCase } from '@/modules/messages/use-cases/messages/process-message.usecase';

@Injectable()
export class ConversationService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @InjectRepository(CashierNotification)
    private readonly cashierNotificationRepository: Repository<CashierNotification>,
    private readonly ordersGateway: OrdersGateway,
    private readonly getOrCreateConversationUseCase: GetOrCreateConversationUseCase,
    private readonly processMessageUseCase: ProcessMessageUseCase,
    private readonly findConversationsByBranchUseCase: FindConversationsByBranchUseCase,
    private readonly deleteConversationUseCase: DeleteConversationUseCase,
  ) {}

  getOrCreateConversation(
    phoneNumber: string,
    branchId: string,
  ): Promise<Conversation> {
    return this.getOrCreateConversationUseCase.execute(phoneNumber, branchId);
  }

  processMessage(
    phoneNumber: string,
    userMessage: string,
    branch: Branch,
    customer: Customer,
  ): Promise<string> {
    return this.processMessageUseCase.execute(
      phoneNumber,
      userMessage,
      branch,
      customer,
    );
  }

  findByBranch(branchId: string): Promise<ConversationsListResponse> {
    return this.findConversationsByBranchUseCase.execute(branchId);
  }

  async deleteConversation(conversationId: string): Promise<void> {
    const conversation = await this.conversationRepository.findOne({
      where: { conversationId },
      select: ['branchId'],
    });

    await this.deleteConversationUseCase.execute(conversationId);

    if (conversation?.branchId) {
      this.ordersGateway.emitOrderUpdate(conversation.branchId);
    }
  }

  markNotificationAsRead(notificationId: string): Promise<void> {
    return this.setNotificationActive(notificationId, false);
  }

  markNotificationAsUnread(notificationId: string): Promise<void> {
    return this.setNotificationActive(notificationId, true);
  }

  async getNotificationsByBranch(branchId: string): Promise<{
    active: CashierNotification[];
    inactive: CashierNotification[];
  }> {
    const [active, inactive] = await Promise.all([
      this.cashierNotificationRepository.find({
        where: { branchId, isActive: true },
        order: { createdAt: 'DESC' },
        take: 10,
      }),
      this.cashierNotificationRepository.find({
        where: { branchId, isActive: false },
        order: { createdAt: 'ASC' },
        take: 10,
      }),
    ]);

    return { active, inactive };
  }

  private async setNotificationActive(
    notificationId: string,
    isActive: boolean,
  ): Promise<void> {
    const notification = await this.cashierNotificationRepository.findOne({
      where: { id: notificationId },
      relations: ['customer'],
    });

    if (!notification || notification.isActive === isActive) return;

    notification.isActive = isActive;
    const updated = await this.cashierNotificationRepository.save(notification);

    if (notification.branchId) {
      this.ordersGateway.emitNotificationUpdate(notification.branchId, updated);
    }
  }
}
