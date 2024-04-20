import express, { Application, Request, Response } from 'express';
import { middleware, WebhookEvent } from '@line/bot-sdk';
import { lineBotConfig, textEventHandler } from './line';

import { load } from 'ts-dotenv';
import { checkAsk } from './openai';
import { checkGenerateArt, generateArt } from './stable-diffusion';
import { uploadImage } from './google';
const env = load({
  PORT: String,
});
const PORT = env.PORT || 3000;

const app: Application = express();

app.get('/', async (req: Request, res: Response) => {
  const message = await checkAsk("Hello")
  res.send(message)
});

app.get('/image', async (req: Request, res: Response) => {
  const prompt = 'a dog walking on the beach with sunglasses, portrait, ultra realistic, futuristic background , concept art, intricate details, highly detailed';
  const imageUrl = await checkGenerateArt(prompt);
  res.send(encodeURI(imageUrl))
});

app.post('/webhook', middleware(lineBotConfig),
  async (req: Request, res: Response): Promise<Response> => {
    await Promise.all(
      req.body.events.map( async (event: WebhookEvent) => {
        try {
          await textEventHandler(event);
        } catch (err: unknown) {
          if (err instanceof Error) {
            console.error(err);
          }
          return res.status(500);
        }
      })
    );
    return res.status(200);
  }
);

app.listen(PORT);
console.log(`Server running at ${PORT}`);