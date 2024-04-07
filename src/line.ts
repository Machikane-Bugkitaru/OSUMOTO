import {
  Client,
  WebhookEvent,
  TextMessage,
  MessageAPIResponseBase,
  ImageMessage,
} from '@line/bot-sdk';
import { load } from 'ts-dotenv';
import { ask, generateImageByDalle } from './openai';
import { generateArt } from './stable-diffusion';

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
const channelBotName = env.CHANNEL_BOT_NAME || "BOT";

const lineClient = new Client(lineBotConfig);
const groupMemberMap = new Map<string, string>();

const textEventHandler = async (event: WebhookEvent): Promise<MessageAPIResponseBase | undefined> => {
  if (event.type !== 'message' || event.message.type !== 'text') return;

  // groupチャットでなければ、return
  if (event.source.type !== 'group') return;
  const {userId, groupId } = event.source;
  if (!userId) return;

  const { text } = event.message;
  // 冒頭がbotの名前でなければ、return
  if (!text.startsWith(channelBotName)) return;

  let response: TextMessage | ImageMessage;
  if (text.startsWith(`${channelBotName}画伯`)) {
    response = await useDalle(text.replace(`${channelBotName}画伯`, "").trim())
  } else {
    response = await useChatGpt(userId, groupId, text)
  }
  await lineClient.replyMessage(event.replyToken, response);
};

const useChatGpt = async (userId: string, groupId: string, text: string): Promise<TextMessage> => {
  // 直前の送信者の名前を抽出
  const senderName = await extractSenderName(userId, groupId);

  // chatGPTに投げる
  let res = await ask(`${senderName}:${text}`)
  if (!res) {
    return {
      type: 'text',
      text: "エラーでちゃ"
    };
  }

  // 回答文を加工
  if (new RegExp(`^${channelBotName}[:：]*`).test(res)) {
    res = res.replace(channelBotName, '').substring(1);
  }
  return {
    type: 'text',
    text: res.trim()
  };
}

const useDalle = async (prompt: string): Promise<ImageMessage | TextMessage> => {
  const imageUrl = await generateImageByDalle(prompt);
  return imageUrl === null ? {
    type: 'text',
    text: 'なんか失敗しちゃ'
  } : {
    type: 'image',
    originalContentUrl: encodeURI(imageUrl),
    previewImageUrl: encodeURI(imageUrl)
  };
}

const useStableDiffusion = async (prompt: string): Promise<ImageMessage> => {
  const imageUrl = await generateArt(prompt);
  return {
    type: 'image',
    originalContentUrl: encodeURI(imageUrl),
    previewImageUrl: encodeURI(imageUrl)
  };
}

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
    .then( profile => {
      if (profile) groupMemberMap.set(userId, profile.displayName);
    })
    .catch( err => console.error(err) );

  return groupMemberMap.get(userId);
}

export {
  lineBotConfig,
  textEventHandler
}