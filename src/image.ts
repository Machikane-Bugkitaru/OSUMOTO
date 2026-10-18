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
  const response = await client.images.generate({
    model: env.OPENAI_IMAGE_MODEL,
    prompt,
    n: 1,
    size: '1024x1024',
    quality: 'low',
    output_format: 'png',
  });

  const image = response.data?.[0]?.b64_json;
  if (!image) {
    throw new Error('OpenAI から画像データが返されませんでした。');
  }

  return uploadImage(prompt.substring(0, 10), image);
};

export const checkGenerateArt = async (prompt: string) => {
  const content = fs.readFileSync(path.join(__dirname, '../public/images/sample.png'));
  const imageUrl = await uploadImage(prompt.substring(0, 10), content.toString('base64'));
  return imageUrl;
};
