import path from 'node:path';

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

export const loadImageStorageConfig = () => {
  const credentials = readCredentials();
  return {
    ...(credentials
      ? { credentials }
      : { keyFile: path.join(__dirname, '../../credentials.json') }),
    folderId: '1lLo7CG0ZdhTooWsAsC2NEs34QEUb8UgZ',
  };
};
export type ImageStorageConfig = ReturnType<typeof loadImageStorageConfig>;
