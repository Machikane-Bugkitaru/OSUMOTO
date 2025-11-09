import OpenAI from 'openai';
import { load } from 'ts-dotenv';
const env = load({
  OPENAI_API_KEY: String,
  OPENAI_MODEL: String,
  SYSTEM_SETTINGS: String,
  MESSAGE_HISTORY_LIMIT: {
    type: Number,
    default: 10,
  },
});

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY || '',
});
const systemSettings = env.SYSTEM_SETTINGS;

type Message = {
  role: 'user' | 'system' | 'assistant';
  content: string;
};
const pastMessages: Message[] = [];

export async function ask(content: string): Promise<string> {
  if (pastMessages.length >= env.MESSAGE_HISTORY_LIMIT) {
    pastMessages.shift();
  }
  pastMessages.push({ role: 'user', content: content });
  try {
    const completion = await openai.chat.completions.create({
      model: env.OPENAI_MODEL,
      messages: [{ role: 'system', content: systemSettings }, ...pastMessages],
    });

    return completion.choices[0]?.message?.content || '';
  } catch (error: any) {
    if (error?.response) {
      return `${error.response.status}, ${error.response.data}`;
    } else {
      return `${error?.type || 'Error'}, ${error?.message || 'Unknown error'}`;
    }
  }
}

export async function checkAsk(content: string) {
  if (pastMessages.length >= env.MESSAGE_HISTORY_LIMIT) {
    pastMessages.shift();
  }
  pastMessages.push({ role: 'user', content: content });
  return [{ role: 'system', content: systemSettings }, ...pastMessages];
}
