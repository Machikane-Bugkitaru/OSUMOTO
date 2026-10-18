import { Stream } from 'node:stream';
import path from 'path';
import { google } from 'googleapis';

const readCredentials = () => {
  const value = process.env.GOOGLE_CREDENTIALS_JSON;
  if (value === undefined) return undefined;

  let credentials: unknown;
  try {
    credentials = JSON.parse(value);
  } catch {
    // パーサーの例外には秘密鍵の断片が含まれうるため、設定値を含まないエラーに置き換える。
    throw new Error('GOOGLE_CREDENTIALS_JSON は有効な JSON で指定してください。');
  }
  if (
    typeof credentials !== 'object' ||
    credentials === null ||
    !('type' in credentials) ||
    credentials.type !== 'service_account' ||
    !('client_email' in credentials) ||
    typeof credentials.client_email !== 'string' ||
    !credentials.client_email.trim() ||
    !('private_key' in credentials) ||
    typeof credentials.private_key !== 'string' ||
    !credentials.private_key.trim()
  ) {
    throw new Error('GOOGLE_CREDENTIALS_JSON にサービスアカウントの認証情報が必要です。');
  }
  return { client_email: credentials.client_email, private_key: credentials.private_key };
};

export const uploadImage = async (fileName: string, base64Data: string) => {
  const credentials = readCredentials();
  const auth = new google.auth.GoogleAuth({
    // Git からのデプロイでは秘密鍵ファイルを配布せず、ローカルの既存ファイルにも対応する。
    ...(credentials ? { credentials } : { keyFile: path.join(__dirname, '../credentials.json') }),
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
      parents: ['1lLo7CG0ZdhTooWsAsC2NEs34QEUb8UgZ'],
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
};
