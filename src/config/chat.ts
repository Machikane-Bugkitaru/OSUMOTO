import { load } from 'ts-dotenv';

export const loadChatConfig = () => {
  const env = load({
    OPENAI_API_KEY: String,
    OPENAI_MODEL: String,
    SYSTEM_SETTINGS: String,
    MESSAGE_HISTORY_LIMIT: { type: Number, default: 10 },
  });
  return {
    apiKey: env.OPENAI_API_KEY,
    model: env.OPENAI_MODEL,
    systemSettings: env.SYSTEM_SETTINGS,
    historyLimit: env.MESSAGE_HISTORY_LIMIT,
  };
};
