const { loadModule } = require('./helpers.cjs');

function loadLineModule(mocks) {
  const { createLineClient } = loadModule('clients/line.ts', {
    '@line/bot-sdk': mocks['@line/bot-sdk'],
  });
  const { createLineEventHandler } = loadModule('adapters/line/event-handler.ts', {});
  return {
    textEventHandler: createLineEventHandler({
      botName: 'BOT',
      ...mocks['./bootstrap'],
      generateArt: mocks['./image'].generateArt,
      lineClient: createLineClient({
        channelAccessToken: 'test-token',
        channelSecret: 'test-secret',
      }),
    }),
  };
}
module.exports = { loadLineModule };
