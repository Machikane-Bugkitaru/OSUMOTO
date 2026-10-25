import type { TextMessage } from '@line/bot-sdk';
import type { ReplyToMessage } from '../../usecases/reply-to-message';
import { getGenerationErrorMessage } from './generation-error';

export const lineReplyInstructions = `返信は Markdown に対応していない LINE のトーク画面に表示されます。以下の形式を守ってください。
- プレーンテキストで回答し、Markdown の見出し、強調、表、引用、コードブロック、インラインコードは使わないでください。
- 読みやすさは短い段落と改行で整えてください。列挙が必要なら「・」や「1.」を使ってください。
- リンクや出典は Markdown のリンク記法にせず、改行して URL だけを独立した行に書いてください。URL を括弧やバッククォートで囲んだり、同じ行に説明や句読点を付けたりしないでください。
- リンクの説明が必要なら、URL の前の行に書いてください。`;

type Ask = ReplyToMessage;

// Preserve the string API used by the LINE adapter and local chat check.
export const createChatAnswer =
  (replyToMessage: ReplyToMessage): Ask =>
  async (groupId, content) => {
    try {
      return await replyToMessage(groupId, content);
    } catch (error: unknown) {
      return getGenerationErrorMessage(error) ?? 'なんか失敗したわ。もっかいたのむで。';
    }
  };

export const createChatReply =
  ({
    ask,
    getSenderName,
    botName,
  }: {
    ask: Ask;
    getSenderName: (userId: string, groupId: string) => Promise<string | undefined>;
    botName: string;
  }) =>
  async (userId: string, groupId: string, text: string): Promise<TextMessage> => {
    // 名前取得中に後続画像が先の発言へ割り込まないよう、履歴キュー内で名前を取得する。
    let res = await ask(groupId, async () => `${await getSenderName(userId, groupId)}:${text}`);

    // 回答文を加工
    if (new RegExp(`^${botName}[:：]*`).test(res)) {
      res = res.replace(botName, '').substring(1);
    }
    return {
      type: 'text',
      text: res.trim(),
    };
  };
