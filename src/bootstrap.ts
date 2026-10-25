import { loadImageGenerationConfig } from './config/image-generation';
import { createOpenAIImageClient } from './clients/openai-image';
import { imageStorageClient } from './clients/image-storage';
import { createGenerateImage } from './usecases/generate-image';

import { loadChatConfig } from './config/chat';
import { createOpenAIChatClient } from './clients/openai-chat';
import { createConversationHistory } from './services/conversation';
import { webSearchInstructions } from './clients/web-search';
import { createChatAnswer, lineReplyInstructions } from './adapters/line/chat-reply';
import { createReplyToMessage } from './usecases/reply-to-message';
import { createRememberImage } from './usecases/remember-image';

export const generateArt = createGenerateImage({
  images: createOpenAIImageClient(loadImageGenerationConfig()),
  storage: imageStorageClient,
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
