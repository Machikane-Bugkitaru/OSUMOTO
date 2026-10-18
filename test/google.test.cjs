const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { loadModule } = require('./helpers.cjs');

async function withCredentials(value, check) {
  const previous = process.env.GOOGLE_CREDENTIALS_JSON;
  if (value === undefined) delete process.env.GOOGLE_CREDENTIALS_JSON;
  else process.env.GOOGLE_CREDENTIALS_JSON = value;
  try {
    await check();
  } finally {
    if (previous === undefined) delete process.env.GOOGLE_CREDENTIALS_JSON;
    else process.env.GOOGLE_CREDENTIALS_JSON = previous;
  }
}

function googleModule(checkAuth) {
  return loadModule('google.ts', {
    googleapis: {
      google: {
        auth: {
          GoogleAuth: class {
            constructor(options) {
              checkAuth(options);
            }
          },
        },
        drive: () => ({
          files: {
            create: async (request, options) => {
              assert.equal(options.timeout, 10_000);
              assert.equal(options.retry, false);
              assert.equal(request.media.mimeType, 'image/png');
              let content = '';
              for await (const chunk of request.media.body) content += chunk.toString();
              assert.equal(content, 'png');
              return { status: 200, data: { id: 'image-id' } };
            },
          },
        }),
      },
    },
  });
}

test('環境変数の認証情報を優先し、ファイルを参照せず保存できる', async () => {
  const credentials = {
    type: 'service_account',
    client_email: 'test@example.com',
    private_key: 'test-only-key\nsecond-line',
  };
  await withCredentials(JSON.stringify(credentials), async () => {
    const { uploadImage } = googleModule((options) => {
      assert.equal(options.keyFile, undefined);
      assert.deepEqual(options.credentials, {
        client_email: credentials.client_email,
        private_key: credentials.private_key,
      });
    });
    assert.equal(await uploadImage('test', 'cG5n'), 'https://drive.google.com/uc?id=image-id');
  });
});

test('環境変数がなければ既存の認証ファイルを使う', async () => {
  await withCredentials(undefined, async () => {
    const { uploadImage } = googleModule((options) => {
      assert.equal(options.credentials, undefined);
      assert.equal(options.keyFile, path.resolve(__dirname, '../credentials.json'));
    });
    await uploadImage('test', 'cG5n');
  });
});

for (const value of ['', 'secret-fragment', 'null', '[]', '{}', '{"type":"external_account"}']) {
  test(`不正な設定では認証・保存せず、設定値をエラーに含めない: ${value}`, async () => {
    await withCredentials(value, async () => {
      const { uploadImage } = googleModule(() => assert.fail('認証してはいけない'));
      await assert.rejects(uploadImage('test', 'cG5n'), (error) => {
        assert.match(error.message, /^GOOGLE_CREDENTIALS_JSON /);
        assert.doesNotMatch(error.message, /secret-fragment|external_account/);
        return true;
      });
    });
  });
}
