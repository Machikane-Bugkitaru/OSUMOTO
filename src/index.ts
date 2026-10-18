import express, { Application, Request, Response, NextFunction } from 'express';
import { middleware, WebhookEvent, SignatureValidationFailed, JSONParseError } from '@line/bot-sdk';
import { lineBotConfig, textEventHandler } from './line';

import { load } from 'ts-dotenv';
import { ask } from './gpt';
import { checkGenerateArt } from './image';
import { createEventDeduplicator } from './deduplication';
const env = load({
  PORT: String,
});
const PORT = env.PORT || 3000;

export const app: Application = express();
const processOnce = createEventDeduplicator();

// ローカルのみ有効
if (process.env.NODE_ENV === 'local') {
  app.get('/', async (req: Request, res: Response) => {
    const message = await ask('local', 'Hello');
    res.send(message);
  });

  app.get('/image', async (req: Request, res: Response) => {
    const prompt =
      'a dog walking on the beach with sunglasses, portrait, ultra realistic, futuristic background , concept art, intricate details, highly detailed';
    const imageUrl = await checkGenerateArt(prompt);
    res.send(encodeURI(imageUrl));
  });
}

app.post(
  '/webhook',
  middleware(lineBotConfig),
  async (req: Request, res: Response): Promise<Response> => {
    if (
      !Array.isArray(req.body?.events) ||
      req.body.events.some((event: unknown) => event === null || typeof event !== 'object')
    )
      return res.sendStatus(400);

    // 一件の失敗で他のイベントの完了を待たずに応答しないよう、全結果を集約する。
    const results = await Promise.allSettled(
      req.body.events.map((event: WebhookEvent & { webhookEventId?: string }) =>
        processOnce(event.webhookEventId, async () => {
          await textEventHandler(event);
        }),
      ),
    );
    const failed = results.some((result) => result.status === 'rejected');
    for (const [index, result] of results.entries()) {
      if (result.status !== 'rejected') continue;
      const reason: unknown = result.reason;
      // SDKの例外全体には認証情報や本文が含まれうるため、診断に必要な項目だけ残す。
      console.error('Webhook イベントの処理に失敗しました', {
        eventId: req.body.events[index].webhookEventId,
        name: reason instanceof Error ? reason.name : 'UnknownError',
        status:
          typeof reason === 'object' &&
          reason !== null &&
          'statusCode' in reason &&
          typeof reason.statusCode === 'number'
            ? reason.statusCode
            : undefined,
      });
    }
    return res.sendStatus(failed ? 500 : 200);
  },
);

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof SignatureValidationFailed) return res.sendStatus(403);
  if (error instanceof JSONParseError) return res.sendStatus(400);
  console.error('Webhook リクエストを処理できませんでした');
  return res.sendStatus(500);
});

if (require.main === module) {
  app.listen(PORT);
  console.log(`Server running at ${PORT}`);
}

export default app;
