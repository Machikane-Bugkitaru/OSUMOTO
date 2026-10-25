import type { createConversationHistory } from '../services/conversation';
import type { ChatClient } from '../clients/chat';

export type ConversationHistory = ReturnType<typeof createConversationHistory>;
export type ReplyToMessage = (
  groupId: string,
  content: string | (() => Promise<string>),
) => Promise<string>;

export const createReplyToMessage =
  ({ history, chat }: { history: ConversationHistory; chat: ChatClient }): ReplyToMessage =>
  async (groupId, content) => {
    try {
      // Keep deferred sender-name lookup inside the same queue as image reception.
      return await history(groupId, content, (messages) => chat.reply(messages));
    } catch (error: unknown) {
      console.error('チャット応答に失敗しました', {
        name: error instanceof Error ? error.name : 'UnknownError',
      });
      throw error;
    }
  };
