const maxBytes = 8 * 1024 * 1024;
export class ImageUnavailableError extends Error {}

export const createReadLineImage =
  ({ accessToken }: { accessToken: string }) =>
  async (messageId: string): Promise<string> => {
    try {
      // LINEの固定エンドポイントだけを使い、投稿に含まれる外部URLへ認証情報を送らない。
      const response = await fetch(
        `https://api-data.line.me/v2/bot/message/${encodeURIComponent(messageId)}/content`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(10_000),
        },
      );
      const mime = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
      if (
        !response.ok ||
        !mime ||
        !['image/jpeg', 'image/png', 'image/webp'].includes(mime) ||
        !response.body
      ) {
        await response.body?.cancel();
        throw new ImageUnavailableError();
      }
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > maxBytes) throw new ImageUnavailableError();
          chunks.push(value);
        }
      } finally {
        await reader.cancel();
      }
      if (!size) throw new ImageUnavailableError();
      return `data:${mime};base64,${Buffer.concat(chunks).toString('base64')}`;
    } catch {
      // SDKやfetchの例外にはURL・ヘッダーが含まれうるため、元の例外は公開しない。
      throw new ImageUnavailableError('画像の取得に失敗しました。');
    }
  };
