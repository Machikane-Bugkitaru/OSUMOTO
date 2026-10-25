import type { WebhookEvent, TextMessage, ImageMessage } from '@line/bot-sdk';
import type { LineClient } from '../../clients/line';
import type { ReplyToMessage } from '../../usecases/reply-to-message';
import { createChatReply } from './chat-reply';
import { createImageReply } from './image-reply';

interface Dependencies {
  botName: string;
  ask: ReplyToMessage;
  rememberImage: (groupId: string, messageId?: string) => Promise<void>;
  generateArt: (prompt: string) => Promise<string>;
  lineClient: LineClient;
}

export const createLineEventHandler = ({
  botName,
  ask,
  rememberImage,
  generateArt,
  lineClient,
}: Dependencies) => {
  const channelBotName = botName;
  const groupMemberMap = new Map<string, string>();
  const useImageGeneration = createImageReply(generateArt);
  const useChatGpt = createChatReply({
    ask,
    getSenderName: (userId, groupId) => extractSenderName(userId, groupId),
    botName: channelBotName,
  });

  const textEventHandler = async (event: WebhookEvent): Promise<void> => {
    if (event.type !== 'message') return;

    // groupチャットでなければ、return
    if (event.source.type !== 'group') return;
    const { userId, groupId } = event.source;
    if (!userId) return;

    if (event.message.type === 'image') {
      await rememberImage(
        groupId,
        event.message.contentProvider.type === 'line' ? event.message.id : undefined,
      );
      return;
    }
    if (event.message.type !== 'text') return;

    const { text } = event.message;
    // 冒頭がbotの名前でなければ、return
    if (!text.startsWith(channelBotName)) return;

    let response: TextMessage | ImageMessage;
    if (text.startsWith(`${channelBotName}画伯`)) {
      response = await useImageGeneration(text.replace(`${channelBotName}画伯`, '').trim());
    } else {
      response = await useChatGpt(userId, groupId, text);
    }
    await lineClient.replyMessage(event.replyToken, response);
  };

  /**
   * 送信者の名前を抽出して返す
   * @param userId
   * @param groupId
   * @returns
   */
  const extractSenderName = async (userId: string, groupId: string) => {
    if (groupMemberMap.has(groupId)) {
      return groupMemberMap.get(userId);
    }
    groupMemberMap.clear();

    await lineClient
      .getGroupMemberProfile(groupId, userId)
      .then((profile) => {
        if (profile) groupMemberMap.set(userId, profile.displayName);
      })
      .catch((err) => console.error(err));

    return groupMemberMap.get(userId);
  };

  return textEventHandler;
};
