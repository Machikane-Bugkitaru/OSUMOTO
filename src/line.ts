import {
  Client,
  WebhookEvent,
  TextMessage,
  MessageAPIResponseBase,
  ImageMessage,
} from '@line/bot-sdk';
import { load } from 'ts-dotenv';
import { createImageReply } from './adapters/line/image-reply';
import { ask, rememberImage } from './gpt';
import { generateArt } from './image';

const env = load({
  CHANNEL_ACCESS_TOKEN: String,
  CHANNEL_SECRET: String,
  CHANNEL_BOT_NAME: String,
  PORT: Number,
});

const lineBotConfig = {
  channelAccessToken: env.CHANNEL_ACCESS_TOKEN || '',
  channelSecret: env.CHANNEL_SECRET || '',
};
const channelBotName = env.CHANNEL_BOT_NAME || 'BOT';

const lineClient = new Client(lineBotConfig);
const groupMemberMap = new Map<string, string>();
const useImageGeneration = createImageReply(generateArt);

const textEventHandler = async (
  event: WebhookEvent,
): Promise<MessageAPIResponseBase | undefined> => {
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

const useChatGpt = async (userId: string, groupId: string, text: string): Promise<TextMessage> => {
  // 名前取得中に後続画像が先の発言へ割り込まないよう、履歴キュー内で名前を取得する。
  let res = await ask(groupId, async () => `${await extractSenderName(userId, groupId)}:${text}`);

  // 回答文を加工
  if (new RegExp(`^${channelBotName}[:：]*`).test(res)) {
    res = res.replace(channelBotName, '').substring(1);
  }
  return {
    type: 'text',
    text: res.trim(),
  };
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

export { lineBotConfig, textEventHandler };
