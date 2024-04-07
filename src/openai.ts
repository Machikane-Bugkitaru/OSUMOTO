import { OpenAI } from "openai";
import { load } from 'ts-dotenv';
const env = load({
  OPENAI_API_KEY: String,
  SYSTEM_SETTINGS: String,
});

const openai = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY']
});
const systemSettings = env.SYSTEM_SETTINGS

type Message = {
  role: "user" | "system" | "assistant";
  content: string;
};
const pastMessages: Message[] = [];

export async function ask(content: string): Promise<string | null> {
  if (pastMessages.length > 5) {
    pastMessages.shift()
  }
  pastMessages.push({role: "user", content: content});
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {role: "system", content: systemSettings},
        ...pastMessages,
      ],
    });

    return completion.choices[0].message.content
  } catch (error: any) {
    if (!error && error.response) {
      return `${error.response.status}, ${error.response.data}`;
    } else {
      return `${error.type}, ${error.message}`;
    };
  };
};

export async function checkAsk(content: string) {
  if (pastMessages.length > 2) {
    pastMessages.shift()
  }
  pastMessages.push({role: "user", content: content});
  return [
    {role: "system", content: systemSettings},
    ...pastMessages,
  ]
}

/**
 * Dall-E で画像生成
 */
export async function generateImageByDalle(prompt: string): Promise<string | null> {
  try {
    // 画像を生成
    const imageResponse = await openai.images.generate({
      model: "dall-e-3", // 画像生成モデル
      prompt: prompt, // 生成したい画像を文字で表したもの
      n: 1, // 生成する画像の数 DALL-E 3ではn=1のみサポートされています
      size: "1024x1024", // 生成する画像のサイズ DALL-E 3では1024x1024、1792x1024、1024x1792から選べます
    });

    // 画像のURLを取得 data[0]のように配列で取得する必要がある
    const imageUrl = imageResponse.data[0].url;
    return imageUrl || null
  } catch (error) {
    return null
  }
}