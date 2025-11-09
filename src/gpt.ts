import OpenAI from 'openai';
import { EasyInputMessage } from 'openai/resources/responses/responses';
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

const client = new OpenAI({
  apiKey: env.OPENAI_API_KEY || '',
});
const systemSettings = env.SYSTEM_SETTINGS;

const pastMessages: EasyInputMessage[] = [];

export async function ask(content: string): Promise<string> {
  // メッセージ履歴の制限を超えた場合、最も古いメッセージを削除
  if (pastMessages.length >= env.MESSAGE_HISTORY_LIMIT) {
    pastMessages.shift();
  }
  // ユーザーメッセージを履歴に追加
  pastMessages.push({ role: 'user', content: content });
  try {
    // AIに問い合わせ
    const response = await client.responses.create({
      model: env.OPENAI_MODEL,
      input: [{ role: 'developer', content: systemSettings }, ...pastMessages],
    });

    // AIの応答を履歴に追加
    const assistantMessage = response.output_text;
    pastMessages.push({ role: 'assistant', content: assistantMessage });

    // 応答を返す
    return assistantMessage;
  } catch (error: any) {
    if (error?.response) {
      return `${error.response.status}, ${error.response.data}`;
    } else {
      return `${error?.type || 'Error'}, ${error?.message || 'Unknown error'}`;
    }
  }
}
