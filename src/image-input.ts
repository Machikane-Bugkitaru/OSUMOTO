import type { EasyInputMessage } from 'openai/resources/responses/responses';
import type { Message } from './conversation';

export function toImageInput(messages: Message[]): EasyInputMessage[] {
  return messages
    .filter((message) => !message.imageMessage || !!message.imageUrl)
    .map(({ role, content, imageUrl }) => {
      if (!imageUrl) return { role, content };
      return {
        role,
        content: [
          { type: 'input_text', text: content },
          { type: 'input_image', image_url: imageUrl, detail: 'auto' },
        ],
      };
    });
}
