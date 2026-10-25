import type { ImageGenerationClient, ImageStorageClient } from '../clients/image-generation';
import { ImageClientError } from '../clients/image-generation';
import { GeneratedImageUnavailableError } from './image-error';

interface Dependencies {
  images: ImageGenerationClient;
  storage: ImageStorageClient;
  now?: () => number;
}

export const createGenerateImage =
  ({ images, storage, now = Date.now }: Dependencies) =>
  async (prompt: string): Promise<string> => {
    let stage: 'preparation' | 'generation' | 'response' | 'storage' = 'preparation';
    try {
      const deadline = now() + 40_000;
      const imagePrompt = (await images.preparePrompt(prompt)).trim();
      if (!imagePrompt) throw new Error('画像生成用のプロンプトが返されませんでした。');
      const remainingMs = deadline - now();
      if (remainingMs <= 0) throw new Error('画像生成の制限時間を超えました。');
      stage = 'generation';
      const image = await images.generateImage(imagePrompt, remainingMs);
      stage = 'response';
      if (!image) {
        throw new GeneratedImageUnavailableError('OpenAI から画像データが返されませんでした。');
      }
      stage = 'storage';
      return await storage.storeImage(prompt.substring(0, 10), image);
    } catch (error: unknown) {
      // Client failures contain only safe diagnostics, never SDK bodies or credentials.
      console.error('画像処理に失敗しました', {
        stage,
        errorType:
          error instanceof ImageClientError
            ? error.errorType
            : error instanceof Error
              ? error.constructor.name
              : 'UnknownError',
        status: error instanceof ImageClientError ? error.status : undefined,
        providerCode: error instanceof ImageClientError ? error.code : undefined,
      });
      throw error;
    }
  };
