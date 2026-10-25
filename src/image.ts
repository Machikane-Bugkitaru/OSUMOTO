import fs from 'node:fs';
import path from 'node:path';
import { imageStorageClient } from './clients/image-storage';

export { generateArt } from './bootstrap';

export const checkGenerateArt = async (prompt: string) => {
  const content = fs.readFileSync(path.join(__dirname, '../public/images/sample.png'));
  return imageStorageClient.storeImage(prompt.substring(0, 10), content.toString('base64'));
};
