import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { Conversation } from '@/modules/messages/entities/conversation.entity';
import { ConversationsListResponse } from '@/modules/messages/interfaces/conversations.interfaces';

@Injectable()
export class FindConversationsByBranchUseCase {
  private readonly logger = new Logger(FindConversationsByBranchUseCase.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
  ) {}

  async execute(branchId: string): Promise<ConversationsListResponse> {
    const conversations = await this.conversationRepository.find({
      where: {
        branchId,
        lastOrderSentAt: Not(IsNull()),
      },
      order: {
        lastOrderSentAt: 'DESC',
      },
      relations: {
        branch: true,
        customer: true,
      },
      select: {
        id: true,
        conversationId: true,
        branchId: true,
        location: true,
        lastOrderSentAt: true,
        lastOrderSentToCashier: true,
        createdAt: true,
        branch: {
          id: true,
        },
        customer: {
          name: true,
        },
      },
    });

    this.logger.debug(
      `Found ${conversations.length} conversations for branch ${branchId}`,
    );

    return {
      conversations,
      total: conversations.length,
    };
  }
}
