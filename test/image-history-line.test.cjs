const assert = require('node:assert/strict');
const test = require('node:test');
const { loadLineModule } = require('./line-helpers.cjs');

test('グループの画像受信は履歴へ登録するだけでAPI・返信を呼ばない', async () => {
  const records = [];
  const { textEventHandler } = loadLineModule({
    '@line/bot-sdk': {
      Client: class {
        replyMessage() {
          assert.fail('返信しない');
        }
      },
    },
    './bootstrap': {
      ask: () => assert.fail('生成しない'),
      rememberImage: async (...args) => {
        records.push(args);
      },
    },
    './image': { generateArt: () => assert.fail('生成しない') },
  });
  const event = {
    type: 'message',
    source: { type: 'group', groupId: 'group', userId: 'user' },
    message: { type: 'image', id: 'image', contentProvider: { type: 'line' } },
  };
  await textEventHandler(event);
  await textEventHandler({ ...event, source: { type: 'user', userId: 'user' } });
  await textEventHandler({
    ...event,
    message: {
      ...event.message,
      contentProvider: { type: 'external', originalContentUrl: 'https://untrusted.invalid' },
    },
  });
  assert.deepEqual(records, [
    ['group', 'image'],
    ['group', undefined],
  ]);
});
