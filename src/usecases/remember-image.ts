import type { ConversationHistory } from './reply-to-message';

export const createRememberImage =
  ({
    history,
    readImage,
  }: {
    history: ConversationHistory;
    readImage: (messageId: string) => Promise<string>;
  }) =>
  (groupId: string, messageId?: string) =>
    history.rememberImage(groupId, messageId ? () => readImage(messageId) : undefined);
