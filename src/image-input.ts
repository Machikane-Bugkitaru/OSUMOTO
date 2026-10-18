import type { EasyInputMessage } from 'openai/resources/responses/responses';
import type { Message } from './conversation';

export async function toImageInput(
  messages: Message[],
  readImage: (messageId: string) => Promise<string>,
  invalidateImage: (messageId: string) => void,
): Promise<EasyInputMessage[]> {
  const results = await Promise.allSettled(
    messages.map(async ({ role, content, imageId }): Promise<EasyInputMessage> => {
      if (!imageId) return { role, content };
      let imageUrl: string;
      try {
        imageUrl = await readImage(imageId);
      } catch (error: unknown) {
        invalidateImage(imageId);
        throw error;
      }
      return {
        role,
        content: [
          { type: 'input_text', text: content },
          { type: 'input_image', image_url: imageUrl, detail: 'auto' },
        ],
      };
    }),
  );
  // 片方の取得失敗後にもう片方の処理が履歴キュー外へ残らないよう、両方の完了を待つ。
  return results.map((result) => {
    if (result.status === 'rejected') throw result.reason;
    return result.value;
  });
}
