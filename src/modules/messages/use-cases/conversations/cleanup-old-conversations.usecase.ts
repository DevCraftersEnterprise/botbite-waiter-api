import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Conversation } from '@/modules/messages/entities/conversation.entity';

const INACTIVITY_LIMIT_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class CleanupOldConversationsUseCase {
  private readonly logger = new Logger(CleanupOldConversationsUseCase.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
  ) {}

  /** Borra las conversaciones sin actividad en las últimas 24 horas. */
  async execute(): Promise<number> {
    const cutoff = new Date(Date.now() - INACTIVITY_LIMIT_MS);

    // DELETE directo (v1 cargaba todas las filas en memoria para borrarlas una
    // a una). Los mensajes asociados se borran por la FK ON DELETE CASCADE.
    const result = await this.conversationRepository.delete({
      lastActivity: LessThan(cutoff),
    });
    const deleted = result.affected ?? 0;

    this.logger.log(
      `Cleaned up ${deleted} conversations inactive for more than 24 hours`,
    );

    return deleted;
  }
}
