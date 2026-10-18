import OpenAI from 'openai';
import { load } from 'ts-dotenv';
import { createConversationHistory } from './conversation';
import { toImageInput } from './image-input';
import { readLineImage } from './line-image';
import { webSearchInstructions } from './web-search';
const env = load({
  OPENAI_API_KEY: String,
  OPENAI_MODEL: String,
  SYSTEM_SETTINGS: String,
  MESSAGE_HISTORY_LIMIT: {
    type: Number,
    default: 10,
  },
});

const client = new OpenAI({
  apiKey: env.OPENAI_API_KEY || '',
});
const systemSettings = [env.SYSTEM_SETTINGS, webSearchInstructions].join('\n\n');

const withHistory = createConversationHistory({ limit: env.MESSAGE_HISTORY_LIMIT });

export const rememberImage = (groupId: string, messageId?: string) =>
  withHistory.rememberImage(groupId, messageId ? () => readLineImage(messageId) : undefined);

export async function ask(
  groupId: string,
  content: string | (() => Promise<string>),
): Promise<string> {
  try {
    return await withHistory(groupId, content, async (messages) => {
      const response = await client.responses.create({
        model: env.OPENAI_MODEL,
        service_tier: 'priority',
        tools: [{ type: 'web_search' }],
        tool_choice: 'auto',
        input: [{ role: 'developer', content: systemSettings }, ...toImageInput(messages)],
      });
      return response.output_text;
    });
  } catch (error: unknown) {
    console.error('チャット応答に失敗しました', {
      name: error instanceof Error ? error.name : 'UnknownError',
    });
    return '回答を生成できませんでした。少し待ってからもう一度お試しください。';
  }
}
