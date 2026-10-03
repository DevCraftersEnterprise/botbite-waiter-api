import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConversationMessage } from '@/modules/messages/entities/conversation-message.entity';
import { Conversation } from '@/modules/messages/entities/conversation.entity';

@Injectable()
export class DeleteConversationUseCase {
  private readonly logger = new Logger(DeleteConversationUseCase.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @InjectRepository(ConversationMessage)
    private readonly messageRepository: Repository<ConversationMessage>,
  ) {}

  async execute(conversationId: string): Promise<void> {
    try {
      await this.messageRepository.delete({ conversationId });
      await this.conversationRepository.delete({ conversationId });

      this.logger.log(
        `Conversation and all its messages deleted: ${conversationId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error deleting conversation ${conversationId}:`,
        error,
      );
      throw error;
    }
  }
}
