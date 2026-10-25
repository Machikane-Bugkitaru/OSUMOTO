const assert = require('node:assert/strict');
const test = require('node:test');
require('../helpers.cjs');
const { createConversationHistory } = require('../../src/conversation');
const { createReplyToMessage } = require('../../src/usecases/reply-to-message');
const { createRememberImage } = require('../../src/usecases/remember-image');
const { createChatReply } = require('../../src/adapters/line/chat-reply');

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

test('LINEの名前取得と後続の画像受信・質問を同じキューで順序どおり処理する', async () => {
  const history = createConversationHistory({ limit: 10 });
  const namesStarted = deferred();
  const releaseName = deferred();
  const inputs = [];
  const events = [];
  const ask = createReplyToMessage({
    history,
    chat: {
      reply: async (messages) => {
        inputs.push(messages);
        events.push('reply');
        return 'BOT: 回答';
      },
    },
  });
  const reply = createChatReply({
    ask,
    botName: 'BOT',
    getSenderName: async () => {
      events.push('name');
      namesStarted.resolve();
      await releaseName.promise;
      return '名前';
    },
  });
  const rememberImage = createRememberImage({
    history,
    readImage: async (id) => {
      events.push(`image:${id}`);
      return 'data:image/png;base64,cG5n';
    },
  });
  const first = reply('user', 'group', 'BOT最初の質問');
  await namesStarted.promise;
  const image = rememberImage('group', 'image-id');
  const second = reply('user', 'group', 'BOT次の質問');
  assert.deepEqual(events, ['name']);
  releaseName.resolve();
  assert.deepEqual(await first, { type: 'text', text: '回答' });
  await image;
  assert.deepEqual(await second, { type: 'text', text: '回答' });
  assert.deepEqual(events, ['name', 'reply', 'image:image-id', 'name', 'reply']);
  assert.deepEqual(inputs[0], [{ role: 'user', content: '名前:BOT最初の質問' }]);
  assert.deepEqual(inputs[1], [
    { role: 'user', content: '名前:BOT最初の質問' },
    { role: 'assistant', content: 'BOT: 回答' },
    { role: 'user', content: '[画像]', imageUrl: 'data:image/png;base64,cG5n', imageMessage: true },
    { role: 'user', content: '名前:BOT次の質問' },
  ]);
});

for (const failure of ['throw', 'empty']) {
  test(`会話の失敗・空回答を履歴に入れず後続を処理する: ${failure}`, async (t) => {
    t.mock.method(console, 'error', () => {});
    const history = createConversationHistory({ limit: 10 });
    const inputs = [];
    const ask = createReplyToMessage({
      history,
      chat: {
        reply: async (messages) => {
          inputs.push(messages);
          if (inputs.length === 1) {
            if (failure === 'throw') throw new Error('provider failure');
            return '   ';
          }
          return '回答';
        },
      },
    });
    await assert.rejects(ask('group', '失敗する質問'));
    assert.equal(await ask('group', '次の質問'), '回答');
    assert.deepEqual(inputs[1], [{ role: 'user', content: '次の質問' }]);
  });
}
