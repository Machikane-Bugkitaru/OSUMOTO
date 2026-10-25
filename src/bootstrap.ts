import { loadImageGenerationConfig } from './config/image-generation';
import { createOpenAIImageClient } from './clients/openai-image';
import { imageStorageClient } from './clients/image-storage';
import { createGenerateImage } from './usecases/generate-image';

export const generateArt = createGenerateImage({
  images: createOpenAIImageClient(loadImageGenerationConfig()),
  storage: imageStorageClient,
});
