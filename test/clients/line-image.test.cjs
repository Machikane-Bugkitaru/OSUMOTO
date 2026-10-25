const assert = require('node:assert/strict');
const test = require('node:test');
const { loadModule } = require('../helpers.cjs');

async function withFetch(fetch, run) {
  const original = global.fetch;
  global.fetch = fetch;
  try {
    const client = loadModule('clients/line-image.ts', {});
    await run({
      ...client,
      readLineImage: client.createReadLineImage({ accessToken: 'test-token' }),
    });
  } finally {
    global.fetch = original;
  }
}

test('LINEの固定URLへ認証して画像を取得し、data URLに変換する', async () => {
  await withFetch(
    async (url, options) => {
      assert.equal(url, 'https://api-data.line.me/v2/bot/message/id%2Ftest/content');
      assert.equal(options.headers.Authorization, 'Bearer test-token');
      assert.ok(options.signal instanceof AbortSignal);
      return new Response(Buffer.from('png'), { headers: { 'content-type': 'image/png' } });
    },
    async ({ readLineImage }) => {
      assert.equal(await readLineImage('id/test'), 'data:image/png;base64,cG5n');
    },
  );
});

for (const failure of ['http', 'type', 'empty', 'size', 'timeout']) {
  test(`取得失敗を安全なエラーへ変換する: ${failure}`, async () => {
    await withFetch(
      async () => {
        if (failure === 'timeout') throw new Error('private token and image content');
        return new Response(
          failure === 'empty'
            ? null
            : failure === 'size'
              ? new Uint8Array(8 * 1024 * 1024 + 1)
              : 'test',
          {
            status: failure === 'http' ? 404 : 200,
            headers: { 'content-type': failure === 'type' ? 'text/html' : 'image/jpeg' },
          },
        );
      },
      async ({ readLineImage, ImageUnavailableError }) => {
        await assert.rejects(readLineImage('id'), (error) => {
          assert.ok(error instanceof ImageUnavailableError);
          assert.doesNotMatch(error.message, /private/);
          return true;
        });
      },
    );
  });
}
