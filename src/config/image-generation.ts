import { load } from 'ts-dotenv';

export interface ImageGenerationConfig {
  apiKey: string;
  promptModel: string;
  imageModel: string;
}

export const loadImageGenerationConfig = (): ImageGenerationConfig => {
  const env = load({
    OPENAI_API_KEY: String,
    OPENAI_MODEL: String,
    OPENAI_IMAGE_MODEL: { type: String, default: 'gpt-image-2.5-flare' },
  });
  return {
    apiKey: env.OPENAI_API_KEY,
    promptModel: env.OPENAI_MODEL,
    imageModel: env.OPENAI_IMAGE_MODEL,
  };
};
