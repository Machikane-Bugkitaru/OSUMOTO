import { load } from 'ts-dotenv';

export const loadLineConfig = () => {
  const env = load({
    CHANNEL_ACCESS_TOKEN: String,
    CHANNEL_SECRET: String,
    CHANNEL_BOT_NAME: String,
    PORT: Number,
  });
  return {
    channelAccessToken: env.CHANNEL_ACCESS_TOKEN || '',
    channelSecret: env.CHANNEL_SECRET || '',
    botName: env.CHANNEL_BOT_NAME || 'BOT',
  };
};
