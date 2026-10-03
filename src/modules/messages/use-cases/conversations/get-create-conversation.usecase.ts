import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from '@/modules/messages/entities/conversation.entity';
import { OpenAIService } from '@/modules/openai/openai.service';

@Injectable()
export class GetOrCreateConversationUseCase {
  private readonly logger = new Logger(GetOrCreateConversationUseCase.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    private readonly openaiService: OpenAIService,
  ) {}

  /**
   * Obtiene la conversación del cliente en la sucursal o la crea.
   *
   * En v1 se usaba SELECT ... FOR UPDATE, que no bloquea filas que aún no
   * existen: dos mensajes simultáneos podían crear dos conversaciones. Ahora
   * el índice único (phoneNumber, branchId) + ON CONFLICT DO NOTHING lo
   * resuelve en la base de datos.
   */
  async execute(phoneNumber: string, branchId: string): Promise<Conversation> {
    await this.conversationRepository
      .createQueryBuilder()
      .insert()
      .into(Conversation)
      .values({
        conversationId: this.openaiService.createConversation(),
        phoneNumber,
        branchId,
        lastActivity: () => 'CURRENT_TIMESTAMP',
      })
      .orIgnore()
      .execute();

    await this.conversationRepository.update(
      { phoneNumber, branchId },
      { lastActivity: new Date() },
    );

    const conversation = await this.conversationRepository.findOneOrFail({
      where: { phoneNumber, branchId },
    });

    this.logger.debug(
      `Using conversation ${conversation.conversationId} for branch ${branchId}`,
    );

    return conversation;
  }
}
