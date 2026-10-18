const assert = require('node:assert/strict');
const test = require('node:test');
const { loadModule } = require('./helpers.cjs');

function imageModule(generate, upload) {
  return loadModule('image.ts', {
    openai: class {
      constructor(options) {
        assert.equal(options.maxRetries, 0);
        assert.equal(options.timeout, 40_000);
        this.images = { generate };
      }
    },
    './google': { uploadImage: upload },
  });
}

test('OpenAI の PNG を既存の保存処理に渡し、保存先 URL を返す', async () => {
  const { generateArt } = imageModule(
    async (request) => {
      assert.equal(request.model, 'gpt-image-2.5-flare');
      assert.equal(request.quality, 'low');
      assert.equal(request.size, '1024x1024');
      assert.equal(request.output_format, 'png');
      assert.equal(request.n, 1);
      assert.equal(request.prompt, '海辺にいる猫を描いてください');
      assert.equal(request.response_format, undefined);
      return { data: [{ b64_json: 'cG5n' }] };
    },
    async (name, image) => {
      assert.equal(name, '海辺にいる猫を描いて');
      assert.equal(image, 'cG5n');
      return 'https://example.com/generated.png';
    },
  );
  assert.equal(
    await generateArt('海辺にいる猫を描いてください'),
    'https://example.com/generated.png',
  );
});

for (const response of [{}, { data: [] }, { data: [{}] }, { data: [{ b64_json: '' }] }]) {
  test(`画像データのない応答は保存しない: ${JSON.stringify(response)}`, async () => {
    const { generateArt } = imageModule(
      async () => response,
      () => assert.fail('保存してはいけない'),
    );
    await assert.rejects(generateArt('猫'), /画像データが返されませんでした/);
  });
}

test('API エラーを画像データとして保存しない', async () => {
  const error = new Error('moderation_blocked');
  const { generateArt } = imageModule(
    async () => {
      throw error;
    },
    () => assert.fail('保存してはいけない'),
  );
  await assert.rejects(generateArt('猫'), error);
});

for (const stage of ['generation', 'storage']) {
  test(`${stage} の失敗工程とステータスを記録し、秘密情報を記録しない`, async () => {
    class ProviderError extends Error {}
    const error = new ProviderError('secret-message');
    error.config = { headers: { Authorization: 'secret-token' } };
    if (stage === 'generation') {
      error.status = 403;
      error.code = 'moderation_blocked';
    } else error.response = { status: 401, data: 'secret-response' };
    const { generateArt } = imageModule(
      async () => {
        if (stage === 'generation') throw error;
        return { data: [{ b64_json: 'cG5n' }] };
      },
      async () => {
        throw error;
      },
    );
    const logs = [];
    const originalError = console.error;
    console.error = (...args) => logs.push(args);
    try {
      await assert.rejects(generateArt('secret-prompt'), (actual) => actual === error);
    } finally {
      console.error = originalError;
    }
    assert.equal(logs.length, 1);
    assert.equal(logs[0][1].stage, stage);
    assert.equal(logs[0][1].errorType, 'ProviderError');
    assert.equal(logs[0][1].status, stage === 'generation' ? 403 : 401);
    assert.equal(
      logs[0][1].providerCode,
      stage === 'generation' ? 'moderation_blocked' : undefined,
    );
    assert.deepEqual(Object.keys(logs[0][1]).sort(), [
      'errorType',
      'providerCode',
      'stage',
      'status',
    ]);
    assert.doesNotMatch(JSON.stringify(logs), /secret-/);
  });
}

const event = (text, source = 'group') => ({
  type: 'message',
  replyToken: 'reply-token',
  source: { type: source, groupId: 'group-id', userId: 'user-id' },
  message: { type: 'text', text },
});

function lineModule(generateArt, replyMessage) {
  return loadModule('line.ts', {
    '@line/bot-sdk': {
      Client: class {
        constructor() {
          this.replyMessage = replyMessage;
        }
      },
    },
    './image': { generateArt },
    './gpt': { ask: () => assert.fail('画伯でチャット API を呼んではいけない') },
  });
}

test('画伯の指示だけを生成に渡し、受信した返信トークンで画像を返す', async () => {
  let reply;
  const { textEventHandler } = lineModule(
    async (prompt) => {
      assert.equal(prompt, '猫');
      return 'https://example.com/cat.png';
    },
    async (token, message) => {
      reply = { token, message };
    },
  );
  await textEventHandler(event('BOT画伯 猫 '));
  assert.deepEqual(reply, {
    token: 'reply-token',
    message: {
      type: 'image',
      originalContentUrl: 'https://example.com/cat.png',
      previewImageUrl: 'https://example.com/cat.png',
    },
  });
});

test('空のプロンプトは生成せず、入力案内を返す', async () => {
  let reply;
  const { textEventHandler } = lineModule(
    () => assert.fail('生成してはいけない'),
    async (_, message) => {
      reply = message;
    },
  );
  await textEventHandler(event('BOT画伯  '));
  assert.equal(reply.type, 'text');
  assert.match(reply.text, /描いてほしい内容/);
});

test('生成・保存の失敗は例外で終わらず、LINE に案内を返す', async () => {
  let reply;
  const { textEventHandler } = lineModule(
    async () => {
      throw new Error('timeout');
    },
    async (_, message) => {
      reply = message;
    },
  );
  const originalError = console.error;
  console.error = () => {};
  try {
    await textEventHandler(event('BOT画伯 猫'));
  } finally {
    console.error = originalError;
  }
  assert.equal(reply.type, 'text');
  assert.match(reply.text, /画像を生成できませんでした/);
});

test('対象外の発言・個別チャットでは画像 API と返信を呼ばない', async () => {
  const { textEventHandler } = lineModule(
    () => assert.fail('生成してはいけない'),
    () => assert.fail('返信してはいけない'),
  );
  await textEventHandler(event('こんにちは'));
  await textEventHandler(event('BOT画伯 猫', 'user'));
});

test('LINEのgroupIdをチャット履歴のキーとして渡す', async () => {
  let reply;
  const { textEventHandler } = loadModule('line.ts', {
    '@line/bot-sdk': {
      Client: class {
        async getGroupMemberProfile() {
          return { displayName: '太郎' };
        }
        async replyMessage(_token, message) {
          reply = message;
        }
      },
    },
    './image': { generateArt: () => assert.fail('画像を生成してはいけない') },
    './gpt': {
      ask: async (groupId, text) => {
        assert.equal(groupId, 'group-id');
        assert.equal(text, '太郎:BOTこんにちは');
        return 'こんにちは';
      },
    },
  });
  await textEventHandler(event('BOTこんにちは'));
  assert.deepEqual(reply, { type: 'text', text: 'こんにちは' });
});
