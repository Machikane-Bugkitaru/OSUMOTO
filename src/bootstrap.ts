import { loadLineConfig } from './config/line';
import { loadServerConfig } from './config/server';
import { createLineClient } from './clients/line';
import { createReadLineImage } from './clients/line-image';
import { createLineEventHandler } from './adapters/line/event-handler';
import { createHttpApp } from './entrypoints/http';
import { createCheckGenerateArt } from './entrypoints/local-image';
import { loadImageGenerationConfig } from './config/image-generation';
import { createOpenAIImageClient } from './clients/openai-image';
import { createImageStorageClient } from './clients/image-storage';
import { loadImageStorageConfig } from './config/image-storage';
import { createGenerateImage } from './usecases/generate-image';

import { loadChatConfig } from './config/chat';
import { createOpenAIChatClient } from './clients/openai-chat';
import { createConversationHistory } from './services/conversation';
import { webSearchInstructions } from './clients/web-search';
import { createChatAnswer, lineReplyInstructions } from './adapters/line/chat-reply';
import { createReplyToMessage } from './usecases/reply-to-message';
import { createRememberImage } from './usecases/remember-image';

export const createImageGeneration = () =>
  createGenerateImage({
    images: createOpenAIImageClient(loadImageGenerationConfig()),
    storage: createImageStorageClient(loadImageStorageConfig),
  });

export const createChatServices = ({
  readImage,
}: {
  readImage: (messageId: string) => Promise<string>;
}) => {
  const chatConfig = loadChatConfig();
  const history = createConversationHistory({ limit: chatConfig.historyLimit });
  const chat = createOpenAIChatClient({
    apiKey: chatConfig.apiKey,
    model: chatConfig.model,
    instructions: [chatConfig.systemSettings, webSearchInstructions, lineReplyInstructions].join(
      '\n\n',
    ),
  });

  const ask = createChatAnswer(createReplyToMessage({ history, chat }));
  const rememberImage = createRememberImage({ history, readImage });
  return { ask, rememberImage };
};

export const createApplication = () => {
  const lineConfig = loadLineConfig();
  const serverConfig = loadServerConfig();
  const lineBotConfig = {
    channelAccessToken: lineConfig.channelAccessToken,
    channelSecret: lineConfig.channelSecret,
  };
  const lineClient = createLineClient(lineBotConfig);
  const chat = createChatServices({
    readImage: createReadLineImage({ accessToken: lineConfig.channelAccessToken }),
  });
  const generateArt = createImageGeneration();
  const textEventHandler = createLineEventHandler({
    botName: lineConfig.botName,
    ...chat,
    generateArt,
    lineClient,
  });
  return {
    app: createHttpApp({
      lineBotConfig,
      textEventHandler,
      ...serverConfig,
      ask: chat.ask,
      checkGenerateArt: createCheckGenerateArt(createImageStorageClient(loadImageStorageConfig)),
    }),
    port: serverConfig.port,
  };
};
