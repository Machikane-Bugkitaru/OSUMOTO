const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { loadModule } = require('../helpers.cjs');

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

function googleModule(checkAuth, failure) {
  const { createImageStorageClient } = loadModule('clients/image-storage.ts', {
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
              if (failure) throw failure;
              return { status: 200, data: { id: 'image-id' } };
            },
          },
        }),
      },
    },
  });
  const { loadImageStorageConfig } = loadModule('config/image-storage.ts', {});
  return { uploadImage: createImageStorageClient(loadImageStorageConfig).storeImage };
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
      assert.equal(options.keyFile, path.resolve(__dirname, '../../credentials.json'));
    });
    await uploadImage('test', 'cG5n');
  });
});

for (const value of ['', 'secret-fragment', 'null', '[]', '{}', '{"type":"external_account"}']) {
  test(`不正な設定では認証・保存せず、設定値をエラーに含めない: ${value}`, async () => {
    await withCredentials(value, async () => {
      const { loadImageStorageConfig } = loadModule('config/image-storage.ts', {});
      assert.throws(loadImageStorageConfig, /^Error: GOOGLE_CREDENTIALS_JSON /);
      const { uploadImage } = googleModule(() => assert.fail('認証してはいけない'));
      await assert.rejects(uploadImage('test', 'cG5n'), (error) => {
        assert.equal(error.message, '画像の保存に失敗しました。');
        const { ImageStorageError } = require('../../src/clients/image-generation');
        assert.ok(error instanceof ImageStorageError);
        assert.doesNotMatch(error.message, /secret-fragment|external_account/);
        return true;
      });
    });
  });
}

for (const reason of ['storageQuotaExceeded', 'rateLimitExceeded', 'insufficientPermissions']) {
  test(`Driveの例外を安全な保存失敗へ変換する: ${reason}`, async () => {
    class ProviderError extends Error {}
    const failure = new ProviderError('secret-body');
    failure.response = { status: 403, data: { error: { errors: [{ reason }] } } };
    failure.headers = { authorization: 'secret-token' };
    const { uploadImage } = googleModule(() => {}, failure);
    await assert.rejects(uploadImage('test', 'cG5n'), (error) => {
      const { ImageStorageError } = require('../../src/clients/image-generation');
      assert.ok(error instanceof ImageStorageError);
      assert.equal(error.capacityExceeded, reason === 'storageQuotaExceeded');
      assert.equal(error.status, 403);
      assert.equal(error.errorType, 'ProviderError');
      assert.doesNotMatch(error.message + JSON.stringify(error), /secret-/);
      return true;
    });
  });
}
