import fs from 'node:fs';
import path from 'path';
import OpenAI from 'openai';
import { load } from 'ts-dotenv';
import { uploadImage } from './google';

const env = load({
  OPENAI_API_KEY: String,
  OPENAI_IMAGE_MODEL: {
    type: String,
    default: 'gpt-image-2.5-flare',
  },
});

const client = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
  // LINE の返信期限内に失敗を通知し、再試行による生成の重複も避ける。
  timeout: 40_000,
  maxRetries: 0,
});

export const generateArt = async (prompt: string): Promise<string> => {
  let stage: 'generation' | 'response' | 'storage' = 'generation';
  const startedAt = Date.now();
  try {
    const response = await client.images.generate({
      model: env.OPENAI_IMAGE_MODEL,
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'low',
      output_format: 'png',
    });

    stage = 'response';
    const image = response.data?.[0]?.b64_json;
    if (!image) {
      throw new Error('OpenAI から画像データが返されませんでした。');
    }

    stage = 'storage';
    return await uploadImage(prompt.substring(0, 10), image);
  } catch (error: unknown) {
    const details = typeof error === 'object' && error !== null ? error : {};
    const response = 'response' in details ? details.response : undefined;
    // SDK の name は API エラーでも Error になる。例外全体や本文には認証情報を含みうる。
    console.error('画像処理に失敗しました', {
      stage,
      errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
      status:
        'status' in details && typeof details.status === 'number'
          ? details.status
          : typeof response === 'object' &&
              response !== null &&
              'status' in response &&
              typeof response.status === 'number'
            ? response.status
            : undefined,
      durationMs: Date.now() - startedAt,
      credentialsConfigured: Boolean(process.env.GOOGLE_CREDENTIALS_JSON),
      providerCode:
        'code' in details &&
        typeof details.code === 'string' &&
        /^[a-z][a-z0-9_]{0,63}$/.test(details.code)
          ? details.code
          : undefined,
      parameter:
        'param' in details &&
        typeof details.param === 'string' &&
        ['model', 'prompt', 'n', 'size', 'quality', 'output_format'].includes(details.param)
          ? details.param
          : undefined,
      safetyRejected:
        error instanceof Error && /safety|moderation|content policy/i.test(error.message),
    });
    throw error;
  }
};

export const checkGenerateArt = async (prompt: string) => {
  const content = fs.readFileSync(path.join(__dirname, '../public/images/sample.png'));
  const imageUrl = await uploadImage(prompt.substring(0, 10), content.toString('base64'));
  return imageUrl;
};
