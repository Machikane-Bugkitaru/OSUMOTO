const assert = require('node:assert/strict');
const test = require('node:test');
require('ts-node/register/transpile-only');
const { createConversationHistory } = require('../src/conversation');

test('グループごとに会話履歴を分離する', async () => {
  const ask = createConversationHistory({ limit: 10 });
  await ask('a', 'Aの秘密', async () => 'Aへの回答');
  await ask('b', 'Bの発言', async (messages) => {
    assert.deepEqual(messages, [{ role: 'user', content: 'Bの発言' }]);
    return 'Bへの回答';
  });
  await ask('a', 'Aの続き', async (messages) => {
    assert.deepEqual(
      messages.map((message) => message.content),
      ['Aの秘密', 'Aへの回答', 'Aの続き'],
    );
    return '回答';
  });
});

for (const limit of [0, 1, 2, 3, 10]) {
  test(`履歴上限${limit}件を会話のペアで守る`, async () => {
    const ask = createConversationHistory({ limit });
    for (let i = 0; i < 20; i += 1) {
      await ask('a', `質問${i}`, async (messages) => {
        assert.ok(messages.length <= Math.max(1, limit - 1));
        assert.equal(messages.length % 2, 1);
        assert.equal(messages.at(-1).content, `質問${i}`);
        if (i > 0 && limit >= 4) assert.equal(messages.at(-2).content, `回答${i - 1}`);
        return `回答${i}`;
      });
    }
  });
}

test('同じグループの同時リクエストは直前の回答を待つが、別グループは待たない', async () => {
  const ask = createConversationHistory({ limit: 10 });
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const first = ask('a', '最初', async () => {
    await gate;
    return '最初の回答';
  });
  let secondStarted = false;
  const second = ask('a', '次', async (messages) => {
    secondStarted = true;
    assert.equal(messages[1].content, '最初の回答');
    return '次の回答';
  });
  await ask('b', '別グループ', async () => '独立した回答');
  assert.equal(secondStarted, false);
  release();
  await Promise.all([first, second]);
});

test('失敗と空回答を履歴に残さず、後続の処理を続行できる', async () => {
  const ask = createConversationHistory({ limit: 10 });
  await assert.rejects(
    ask('a', '失敗', async () => {
      throw new Error('test');
    }),
  );
  await assert.rejects(ask('a', '空回答', async () => '   '));
  await ask('a', '再試行', async (messages) => {
    assert.deepEqual(messages, [{ role: 'user', content: '再試行' }]);
    return '成功';
  });
});

test('期限切れとグループ数上限で古い履歴を解放する', async () => {
  let time = 0;
  const ask = createConversationHistory({ limit: 10, maxGroups: 2, ttlMs: 100, now: () => time });
  await ask('a', 'A', async () => '回答');
  time = 1;
  await ask('b', 'B', async () => '回答');
  time = 2;
  await ask('c', 'C', async () => '回答');
  await ask('a', 'A再開', async (messages) => {
    assert.equal(messages.length, 1);
    return '回答';
  });
  time = 102;
  await ask('a', '期限後', async (messages) => {
    assert.equal(messages.length, 1);
    return '回答';
  });
});

test('不正な履歴上限は起動時に検出する', () => {
  for (const limit of [-1, 1.5, NaN, Infinity]) {
    assert.throws(() => createConversationHistory({ limit }));
  }
});
