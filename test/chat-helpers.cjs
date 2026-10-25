const { loadModule } = require('./helpers.cjs');

function loadChatModule(mocks) {
  const OpenAI = require('openai');
  const chatClient = loadModule('clients/openai-chat.ts', {
    openai: { ...OpenAI, __esModule: true, default: mocks.openai },
  });
  const dependencies = {
    './clients/openai-chat': chatClient,
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
  if (mocks['./line-image']) dependencies['./line-image'] = mocks['./line-image'];
  const bootstrap = loadModule('bootstrap.ts', dependencies);
  return loadModule('gpt.ts', { './bootstrap': bootstrap });
}

module.exports = { loadChatModule };
