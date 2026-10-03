import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CleanupOldConversationsUseCase } from '@/modules/messages/use-cases/conversations/cleanup-old-conversations.usecase';

@Injectable()
export class ConversationCleanupService {
  private readonly logger = new Logger(ConversationCleanupService.name);

  constructor(
    private readonly cleanupOldConversationsUseCase: CleanupOldConversationsUseCase,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleDailyCleanup() {
    this.logger.log('Starting daily conversation cleanup task');

    try {
      const deletedCount = await this.cleanupOldConversationsUseCase.execute();

      this.logger.log(
        `Daily cleanup completed. Deleted ${deletedCount} old conversations`,
      );
    } catch (error) {
      this.logger.error('Daily cleanup task failed', error);
    }
  }

  async cleanupNow(): Promise<number> {
    this.logger.log('Manual conversation cleanup triggered');

    return this.cleanupOldConversationsUseCase.execute();
  }
}
