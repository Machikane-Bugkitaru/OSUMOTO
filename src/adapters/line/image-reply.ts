import type { ImageMessage, TextMessage } from '@line/bot-sdk';
import { getGenerationErrorMessage } from '../../generation-error';

export const createImageReply =
  (generateArt: (prompt: string) => Promise<string>) =>
  async (prompt: string): Promise<ImageMessage | TextMessage> => {
    if (!prompt) {
      return { type: 'text', text: '「画伯」のあとに、ワイに描いてほしい内容を書いてくれや' };
    }

    try {
      const imageUrl = await generateArt(prompt);
      return {
        type: 'image',
        originalContentUrl: encodeURI(imageUrl),
        previewImageUrl: encodeURI(imageUrl),
      };
    } catch (error: unknown) {
      return {
        type: 'text',
        text: getGenerationErrorMessage(error) ?? 'なんか失敗したわ。もっかいたのむで。',
      };
    }
  };
