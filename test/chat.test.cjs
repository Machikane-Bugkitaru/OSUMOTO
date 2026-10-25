const assert = require('node:assert/strict');
const test = require('node:test');
const { loadChatModule } = require('./chat-helpers.cjs');

const expectedSettings = `test settings

必要に応じて Web 検索を使い、根拠を確認して回答してください。

次の場合は Web 検索を行ってください。
- 最新情報や、時間とともに変わる情報が必要な場合
- 知らない事柄や、記憶だけでは正確さに自信がない事柄を尋ねられた場合
- ユーザーが検索、調査、事実確認を求めた場合
- 回答するために、指定された URL の内容を確認する必要がある場合

挨拶、雑談、文章の書き換え、翻訳、提供された情報だけで答えられる質問では、検索は不要です。

返信は Markdown に対応していない LINE のトーク画面に表示されます。以下の形式を守ってください。
- プレーンテキストで回答し、Markdown の見出し、強調、表、引用、コードブロック、インラインコードは使わないでください。
- 読みやすさは短い段落と改行で整えてください。列挙が必要なら「・」や「1.」を使ってください。
- リンクや出典は Markdown のリンク記法にせず、改行して URL だけを独立した行に書いてください。URL を括弧やバッククォートで囲んだり、同じ行に説明や句読点を付けたりしないでください。
- リンクの説明が必要なら、URL の前の行に書いてください。`;

test('チャットAPIにグループ別の履歴と既存のモデル設定を渡す', async () => {
  const inputs = [];
  const { ask } = loadChatModule({
    openai: class {
      constructor(options) {
        assert.deepEqual(options, { apiKey: 'test-key' });
        this.responses = {
          create: async (request) => {
            assert.equal(request.model, 'test-model');
            assert.equal(request.service_tier, 'priority');
            assert.deepEqual(request.tools, [{ type: 'web_search' }]);
            assert.equal(request.tool_choice, 'auto');
            assert.deepEqual(request.input[0], { role: 'developer', content: expectedSettings });
            inputs.push(request.input.map((message) => message.content));
            return { output_text: `回答${inputs.length}` };
          },
        };
      }
    },
  });
  await ask('a', 'A');
  await ask('b', 'B');
  await ask('a', 'A続き');
  assert.deepEqual(inputs, [
    [expectedSettings, 'A'],
    [expectedSettings, 'B'],
    [expectedSettings, 'A', '回答1', 'A続き'],
  ]);
});

test('APIの詳細エラーはLINE向けの案内に変換し、失敗した会話を保存しない', async () => {
  let count = 0;
  const { ask } = loadChatModule({
    openai: class {
      constructor() {
        this.responses = {
          create: async (request) => {
            count += 1;
            if (count === 1) throw new Error('private API error detail');
            assert.deepEqual(request.input.slice(1), [{ role: 'user', content: '次の発言' }]);
            return { output_text: '成功' };
          },
        };
      }
    },
  });
  const failure = await ask('a', '失敗する発言');
  assert.equal(failure, 'なんか失敗したわ。もっかいたのむで。');
  assert.doesNotMatch(failure, /private API error detail/);
  assert.equal(await ask('a', '次の発言'), '成功');
});

for (const code of ['insufficient_quota', 'rate_limit_exceeded', 'moderation_blocked', 'timeout']) {
  test(`テキスト生成もエラー種別に応じた返信を返す: ${code}`, async () => {
    const { RateLimitError, BadRequestError, APIConnectionTimeoutError } = require('openai');
    const { ask } = loadChatModule({
      openai: class {
        constructor() {
          this.responses = {
            create: async () => {
              if (code === 'timeout') throw new APIConnectionTimeoutError();
              if (code === 'moderation_blocked') {
                throw new BadRequestError(400, { code }, 'private API details', new Headers());
              }
              throw new RateLimitError(429, { code }, 'private API details', new Headers());
            },
          };
        }
      },
    });
    const expected = {
      insufficient_quota: '金なくなったわ。恵んでくれや。',
      rate_limit_exceeded: 'なんか失敗したわ。もっかいたのむで。',
      moderation_blocked: 'あかんプロンプトみたいや。他ので試してくれや。',
      timeout: '時間かかって失敗したわ。もっかいたのむで。',
    };
    assert.equal(await ask('quota', '質問'), expected[code]);
  });
}

test('画像履歴をモデルinputへ含め、追加質問でも同じ画像を参照する', async () => {
  const reads = [];
  const { ask, rememberImage } = loadChatModule({
    './line-image': {
      ImageUnavailableError: class extends Error {},
      readLineImage: async (id) => {
        reads.push(id);
        return `data:image/png;base64,${id}`;
      },
    },
    openai: class {
      constructor() {
        this.responses = {
          create: async (request) => {
            const images = request.input.flatMap((m) =>
              Array.isArray(m.content) ? m.content.filter((p) => p.type === 'input_image') : [],
            );
            assert.deepEqual(
              images.map((p) => p.image_url),
              ['data:image/png;base64,third'],
            );
            return { output_text: '画像の回答' };
          },
        };
      }
    },
  });
  for (const id of ['first', 'second', 'third']) await rememberImage('images', id);
  assert.equal(await ask('images', '何が写ってる？'), '画像の回答');
  assert.equal(await ask('images', 'もう少し詳しく'), '画像の回答');
  assert.deepEqual(reads, ['first', 'second', 'third']);
});

test('受信時の画像取得失敗はモデルへ渡さず、再送後はメモリの画像だけで回答する', async () => {
  let reads = 0;
  const { ask, rememberImage } = loadChatModule({
    './line-image': {
      readLineImage: async (id) => {
        reads += 1;
        if (id === 'expired') throw new Error('fetch failed');
        return 'data:image/png;base64,resent';
      },
    },
    openai: class {
      constructor() {
        this.responses = {
          create: async (request) => {
            const images = request.input.flatMap((m) =>
              Array.isArray(m.content) ? m.content.filter((p) => p.type === 'input_image') : [],
            );
            if (images.length === 0) {
              assert.deepEqual(request.input.slice(1), [
                { role: 'user', content: '何が写ってる？' },
              ]);
              return { output_text: '回答' };
            }
            assert.equal(images.length, 1);
            return { output_text: '復帰' };
          },
        };
      }
    },
  });
  await rememberImage('recovery', 'expired');
  assert.equal(await ask('recovery', '何が写ってる？'), '回答');
  await rememberImage('recovery', 'resent');
  assert.equal(await ask('recovery', '何が写ってる？'), '復帰');
  assert.equal(await ask('recovery', 'もう一度'), '復帰');
  assert.equal(reads, 2);
});

test('通信エラーの名前だけを既存ログへ残し、詳細や認証情報を公開しない', async (t) => {
  const logs = [];
  t.mock.method(console, 'error', (...args) => logs.push(args));
  const { ask } = loadChatModule({
    openai: class {
      constructor() {
        this.responses = {
          create: async () => {
            const error = new Error('secret-body');
            error.name = 'ProviderFailure';
            error.code = 'rate_limit_exceeded';
            error.headers = { authorization: 'secret-token' };
            throw error;
          },
        };
      }
    },
  });
  assert.equal(await ask('group', '質問'), 'なんか失敗したわ。もっかいたのむで。');
  assert.deepEqual(logs, [['チャット応答に失敗しました', { name: 'ProviderFailure' }]]);
  assert.doesNotMatch(JSON.stringify(logs), /secret-/);
});
