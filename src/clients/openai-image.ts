import OpenAI, { APIConnectionTimeoutError } from 'openai';
import type { ImageGenerationConfig } from '../config/image-generation';
import type { ImageGenerationClient } from './image-generation';
import { ImageClientError } from '../image-error';
import { webSearchInstructions } from './web-search';

export const createOpenAIImageClient = (config: ImageGenerationConfig): ImageGenerationClient => {
  const client = new OpenAI({ apiKey: config.apiKey, timeout: 40_000, maxRetries: 0 });
  return {
    async preparePrompt(prompt) {
      try {
        const preparation = await client.responses.create({
          model: config.promptModel,
          tools: [{ type: 'web_search' }],
          tool_choice: 'auto',
          input: [
            {
              role: 'developer',
              content: `${webSearchInstructions}\n\nユーザーの依頼を画像生成用のプロンプトにしてください。必要なら検索で確認した情報を反映し、元の被写体・構図・画風・指定文字を保ってください。検索が不要なら元の依頼をそのまま返してください。出力は画像生成用のプロンプトだけにしてください。`,
            },
            { role: 'user', content: prompt },
          ],
        });
        return preparation.output_text.trim();
      } catch (error: unknown) {
        throw new ImageClientError(error, error instanceof APIConnectionTimeoutError);
      }
    },
    async generateImage(prompt, timeoutMs) {
      try {
        const response = await client.images.generate(
          {
            model: config.imageModel,
            prompt: prompt,
            n: 1,
            size: '1024x1024',
            quality: 'low',
            output_format: 'png',
          },
          { timeout: timeoutMs },
        );

        return response.data?.[0]?.b64_json;
      } catch (error: unknown) {
        throw new ImageClientError(error, error instanceof APIConnectionTimeoutError);
      }
    },
  };
};
