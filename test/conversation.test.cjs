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
  test(`履歴上限${limit}件を守る`, async () => {
    const ask = createConversationHistory({ limit });
    for (let i = 0; i < 20; i += 1) {
      await ask('a', `質問${i}`, async (messages) => {
        assert.ok(messages.length <= Math.max(1, limit));
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

test('直近10件の新しい画像2枚だけを残し、順序と画像メッセージの枠を維持する', async () => {
  const ask = createConversationHistory({ limit: 10 });
  for (const id of ['old', 'middle', 'new']) await ask.rememberImage('a', id);
  await ask('a', '説明して', async (messages) => {
    assert.equal(messages.length, 4);
    assert.deepEqual(
      messages.filter((m) => m.imageUrl).map((m) => m.imageUrl),
      ['middle', 'new'],
    );
    assert.match(messages[0].content, /直近2枚より前/);
    return '説明';
  });
  await ask('b', '説明して', async (messages) => {
    assert.equal(
      messages.some((m) => m.imageUrl),
      false,
    );
    return '別グループ';
  });
});

test('10件の窓の外から画像を補充せず、ちょうど境界の画像を扱う', async () => {
  const ask = createConversationHistory({ limit: 10 });
  await ask.rememberImage('a', 'image');
  for (let i = 0; i < 4; i += 1) await ask('a', '質問', async () => '回答');
  await ask('a', '境界', async (messages) => {
    assert.equal(messages.length, 10);
    assert.equal(messages[0].imageUrl, 'image');
    return '回答';
  });
  await ask('a', '窓の外', async (messages) => {
    assert.equal(messages.length, 10);
    assert.equal(
      messages.some((m) => m.imageUrl),
      false,
    );
    return '回答';
  });
});

test('名前取得を待つ質問に後から来た画像が割り込まない', async () => {
  const ask = createConversationHistory({ limit: 10 });
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const question = ask(
    'a',
    async () => {
      await gate;
      return '先の質問';
    },
    async (messages) => {
      assert.equal(
        messages.some((m) => m.imageUrl),
        false,
      );
      return '回答';
    },
  );
  const image = ask.rememberImage('a', 'later');
  release();
  await Promise.all([question, image]);
  await ask('a', '次の質問', async (messages) => {
    assert.equal(messages.at(-2).imageUrl, 'later');
    return '回答';
  });
});

test('履歴無効・期限切れの場合は画像も残さない', async () => {
  for (const limit of [0, 10]) {
    let time = 0;
    const ask = createConversationHistory({ limit, ttlMs: 10, now: () => time });
    await ask.rememberImage('a', 'expired');
    time = 10;
    await ask('a', '質問', async (messages) => {
      assert.equal(
        messages.some((m) => m.imageUrl),
        false,
      );
      return '回答';
    });
  }
});

test('画像の受信処理が終わるまで後続の質問を待ち、以後は本体を再利用する', async () => {
  const ask = createConversationHistory({ limit: 10 });
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const image = ask.rememberImage('a', async () => {
    await gate;
    return 'data:image/png;base64,AAAA';
  });
  let called = false;
  const question = ask('a', '質問', async (messages) => {
    called = true;
    assert.equal(messages[0].imageUrl, 'data:image/png;base64,AAAA');
    return '回答';
  });
  await Promise.resolve();
  assert.equal(called, false);
  release();
  await Promise.all([image, question]);
});

test('プロセス全体の画像保持容量を超えると参照を解放し再送案内を残す', async () => {
  const ask = createConversationHistory({ limit: 10, maxImageBytes: 5 });
  await ask.rememberImage('a', 'AAAA');
  await ask.rememberImage('b', 'BBBB');
  await ask('a', '質問', async (messages) => {
    assert.equal(
      messages.some((m) => m.imageUrl),
      false,
    );
    assert.match(messages[0].content, /保持容量/);
    return '回答';
  });
  await ask('b', '質問', async (messages) => {
    assert.equal(messages[0].imageUrl, 'BBBB');
    return '回答';
  });
});

test('回答待ちの間に容量上限で解放した画像を、回答完了時に復活させない', async () => {
  const ask = createConversationHistory({ limit: 10, maxImageBytes: 5 });
  await ask.rememberImage('a', 'AAAA');
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const question = ask('a', '質問', async () => {
    await gate;
    return '回答';
  });
  await ask.rememberImage('b', 'BBBB');
  release();
  await question;
  await ask('a', '次の質問', async (messages) => {
    assert.equal(
      messages.some((m) => m.imageUrl),
      false,
    );
    return '回答';
  });
});
