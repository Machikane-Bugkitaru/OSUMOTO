import fs from 'node:fs';
import path from 'path';
import OpenAI from 'openai';
import { load } from 'ts-dotenv';
import { uploadImage } from './google';
import { webSearchInstructions } from './web-search';

const env = load({
  OPENAI_API_KEY: String,
  OPENAI_MODEL: String,
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
  let stage: 'preparation' | 'generation' | 'response' | 'storage' = 'preparation';
  try {
    const deadline = Date.now() + 40_000;
    const preparation = await client.responses.create({
      model: env.OPENAI_MODEL,
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
    const imagePrompt = preparation.output_text.trim();
    if (!imagePrompt) throw new Error('画像生成用のプロンプトが返されませんでした。');

    // 検索の追加で LINE の返信期限を圧迫しないよう、生成には残り時間だけを割り当てる。
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) throw new Error('画像生成の制限時間を超えました。');
    stage = 'generation';
    const response = await client.images.generate(
      {
        model: env.OPENAI_IMAGE_MODEL,
        prompt: imagePrompt,
        n: 1,
        size: '1024x1024',
        quality: 'low',
        output_format: 'png',
      },
      { timeout: remainingMs },
    );

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
      providerCode:
        'code' in details &&
        typeof details.code === 'string' &&
        /^[a-z][a-z0-9_]{0,63}$/.test(details.code)
          ? details.code
          : undefined,
    });
    throw error;
  }
};

export const checkGenerateArt = async (prompt: string) => {
  const content = fs.readFileSync(path.join(__dirname, '../public/images/sample.png'));
  const imageUrl = await uploadImage(prompt.substring(0, 10), content.toString('base64'));
  return imageUrl;
};
