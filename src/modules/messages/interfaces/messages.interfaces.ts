import { Conversation } from '@/modules/messages/entities/conversation.entity';

export interface ConversationHistoryResponse {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface ConversationsListResponse {
  conversations: Conversation[];
  total: number;
}
