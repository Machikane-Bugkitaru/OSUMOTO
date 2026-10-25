import { loadImageGenerationConfig } from './config/image-generation';
import { createOpenAIImageClient } from './clients/openai-image';
import { imageStorageClient } from './clients/image-storage';
import { createGenerateImage } from './usecases/generate-image';

import { loadChatConfig } from './config/chat';
import { createOpenAIChatClient } from './clients/openai-chat';
import { createConversationHistory } from './conversation';
import { readLineImage } from './line-image';
import { webSearchInstructions } from './web-search';
import { createChatAnswer, lineReplyInstructions } from './adapters/line/chat-reply';
import { createReplyToMessage } from './usecases/reply-to-message';
import { createRememberImage } from './usecases/remember-image';

export const generateArt = createGenerateImage({
  images: createOpenAIImageClient(loadImageGenerationConfig()),
  storage: imageStorageClient,
});

const chatConfig = loadChatConfig();
const history = createConversationHistory({ limit: chatConfig.historyLimit });
const chat = createOpenAIChatClient({
  apiKey: chatConfig.apiKey,
  model: chatConfig.model,
  instructions: [chatConfig.systemSettings, webSearchInstructions, lineReplyInstructions].join(
    '\n\n',
  ),
});

export const ask = createChatAnswer(createReplyToMessage({ history, chat }));
export const rememberImage = createRememberImage({ history, readImage: readLineImage });
