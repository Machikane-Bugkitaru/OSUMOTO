const { loadModule } = require('./helpers.cjs');

function loadChatModule(mocks) {
  const OpenAI = require('openai');
  const chatClient = loadModule('clients/openai-chat.ts', {
    openai: { ...OpenAI, __esModule: true, default: mocks.openai },
  });
  const dependencies = {
    './clients/openai-chat': chatClient,
    './config/chat': {
      loadChatConfig: () => ({
        apiKey: 'test-key',
        model: 'test-model',
        systemSettings: 'test settings',
        historyLimit: 10,
      }),
    },
    './clients/openai-image': {
      createOpenAIImageClient: () => ({
        preparePrompt: () => {
          throw new Error('画像生成を呼んではいけない');
        },
        generateImage: () => {
          throw new Error('画像生成を呼んではいけない');
        },
      }),
    },
  };
  const bootstrap = loadModule('bootstrap.ts', dependencies);
  return bootstrap.createChatServices({
    readImage:
      mocks['./line-image']?.readLineImage ??
      (() => {
        throw new Error('画像取得を呼んではいけない');
      }),
  });
}

module.exports = { loadChatModule };
