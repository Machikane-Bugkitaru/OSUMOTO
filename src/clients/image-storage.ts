import { Stream } from 'node:stream';
import { google } from 'googleapis';
import type { ImageStorageConfig } from '../config/image-storage';
import { ImageStorageError, type ImageStorageClient } from './image-generation';

export const createImageStorageClient = (
  readConfig: () => ImageStorageConfig,
): ImageStorageClient => ({
  async storeImage(fileName, base64Data) {
    try {
      const config = readConfig();
      const auth = new google.auth.GoogleAuth({
        // Git からのデプロイでは秘密鍵ファイルを配布せず、ローカルの既存ファイルにも対応する。
        ...('credentials' in config
          ? { credentials: config.credentials }
          : { keyFile: config.keyFile }),
        scopes: [
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/drive.appdata',
        ],
      });
      const drive = google.drive({ version: 'v3', auth });

      const bs = new Stream.PassThrough();
      bs.end(Buffer.from(base64Data, 'base64'));

      const params = {
        resource: {
          name: fileName,
          parents: [config.folderId],
        },
        media: {
          mimeType: 'image/png',
          body: bs,
        },
        fields: 'id',
      };

      // 画像生成後も LINE の返信に間に合うよう、保存リクエストの待機時間と自動再試行を制限する。
      const response = await drive.files.create(params, { timeout: 10_000, retry: false });
      const { status, statusText } = response;
      if (status < 200 || status >= 400) {
        throw new Error(`status: ${status}, message: ${statusText}`);
      }
      return `https://drive.google.com/uc?id=${response.data.id}`;
    } catch (error: unknown) {
      throw new ImageStorageError(error);
    }
  },
});
