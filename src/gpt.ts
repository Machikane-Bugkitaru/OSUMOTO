import OpenAI from 'openai';
import { load } from 'ts-dotenv';
import { createConversationHistory } from './conversation';
import { toImageInput } from './image-input';
import { readLineImage } from './line-image';
import { webSearchInstructions } from './web-search';
import { getGenerationErrorMessage } from './generation-error';
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
const lineReplyInstructions = `返信は Markdown に対応していない LINE のトーク画面に表示されます。以下の形式を守ってください。
- プレーンテキストで回答し、Markdown の見出し、強調、表、引用、コードブロック、インラインコードは使わないでください。
- 読みやすさは短い段落と改行で整えてください。列挙が必要なら「・」や「1.」を使ってください。
- リンクや出典は Markdown のリンク記法にせず、改行して URL だけを独立した行に書いてください。URL を括弧やバッククォートで囲んだり、同じ行に説明や句読点を付けたりしないでください。
- リンクの説明が必要なら、URL の前の行に書いてください。`;
const systemSettings = [env.SYSTEM_SETTINGS, webSearchInstructions, lineReplyInstructions].join(
  '\n\n',
);

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
    return (
      getGenerationErrorMessage(error) ??
      '回答を生成できませんでした。少し待ってからもう一度お試しください。'
    );
  }
}
