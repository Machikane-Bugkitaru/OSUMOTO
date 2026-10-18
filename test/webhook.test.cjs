const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const test = require('node:test');
const { loadModule } = require('./helpers.cjs');

async function withServer(handler, run) {
  const { app } = loadModule('index.ts', {
    './line': {
      lineBotConfig: { channelAccessToken: 'test-token', channelSecret: 'test-secret' },
      textEventHandler: handler,
    },
    './gpt': { ask: () => assert.fail('チャットAPIを呼んではいけない') },
    './image': { checkGenerateArt: () => assert.fail('画像APIを呼んではいけない') },
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const send = async (events, signature) => {
    const body = JSON.stringify({ events });
    return fetch(`http://127.0.0.1:${server.address().port}/webhook`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-line-signature':
          signature ?? createHmac('sha256', 'test-secret').update(body).digest('base64'),
      },
      body,
      signal: AbortSignal.timeout(2000),
    });
  };
  try {
    await run(send);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('成功と空イベントのHTTP応答が200で完了する', async () => {
  let count = 0;
  await withServer(
    async () => {
      count += 1;
    },
    async (send) => {
      for (const events of [[], [{ type: 'message' }]]) {
        const response = await send(events);
        assert.equal(response.status, 200);
        assert.equal(await response.text(), 'OK');
      }
    },
  );
  assert.equal(count, 1);
});

test('失敗を含むバッチは全イベントを待ち、500で応答を完了する', async () => {
  let completed = false;
  await withServer(
    async (event) => {
      if (event.fail) throw new Error('test failure');
      await new Promise((resolve) => setTimeout(resolve, 20));
      completed = true;
    },
    async (send) => {
      const response = await send([{ fail: true }, {}]);
      assert.equal(response.status, 500);
      assert.equal(await response.text(), 'Internal Server Error');
      assert.equal(completed, true);
    },
  );
});

test('署名が不正なリクエストと不正なeventsを拒否する', async () => {
  await withServer(
    () => assert.fail('処理してはいけない'),
    async (send) => {
      const invalidSignature = await send([{}], 'invalid-signature');
      assert.equal(invalidSignature.status, 403);
      await invalidSignature.text();
      const invalidEvents = await send(null);
      assert.equal(invalidEvents.status, 400);
      await invalidEvents.text();
      for (const events of [[null], [1], ['invalid']]) {
        const invalidElement = await send(events);
        assert.equal(invalidElement.status, 400);
        await invalidElement.text();
      }
    },
  );
});
