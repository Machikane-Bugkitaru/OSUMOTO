import fs from 'node:fs';
import path from 'node:path';
import type { ImageStorageClient } from '../clients/image-generation';

export const createCheckGenerateArt =
  (imageStorageClient: ImageStorageClient) => async (prompt: string) => {
    const content = fs.readFileSync(path.join(__dirname, '../../public/images/sample.png'));
    return imageStorageClient.storeImage(prompt.substring(0, 10), content.toString('base64'));
  };
