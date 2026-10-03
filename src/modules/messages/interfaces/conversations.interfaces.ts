import { Conversation } from '@/modules/messages/entities/conversation.entity';
export interface ConversationsListResponse {
  conversations: Conversation[];
  total: number;
}
