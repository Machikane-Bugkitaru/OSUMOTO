import { uploadImage } from '../google';
import { ImageStorageError } from '../image-error';
import type { ImageStorageClient } from './image-generation';

// Reuse the existing Drive transport (10s upload timeout, retries disabled).
export const imageStorageClient: ImageStorageClient = {
  async storeImage(fileName, base64Data) {
    try {
      return await uploadImage(fileName, base64Data);
    } catch (error: unknown) {
      throw new ImageStorageError(error);
    }
  },
};
