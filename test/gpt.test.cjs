const assert = require('node:assert/strict');
const test = require('node:test');
const { loadModule } = require('./helpers.cjs');

const expectedSettings = `test settings

必要に応じて Web 検索を使い、根拠を確認して回答してください。

次の場合は Web 検索を行ってください。
- 最新情報や、時間とともに変わる情報が必要な場合
- 知らない事柄や、記憶だけでは正確さに自信がない事柄を尋ねられた場合
- ユーザーが検索、調査、事実確認を求めた場合
- 回答するために、指定された URL の内容を確認する必要がある場合

挨拶、雑談、文章の書き換え、翻訳、提供された情報だけで答えられる質問では、検索は不要です。`;

test('チャットAPIにグループ別の履歴と既存のモデル設定を渡す', async () => {
  const inputs = [];
  const { ask } = loadModule('gpt.ts', {
    openai: class {
      constructor() {
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
  const { ask } = loadModule('gpt.ts', {
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
  assert.match(failure, /回答を生成できませんでした/);
  assert.doesNotMatch(failure, /private API error detail/);
  assert.equal(await ask('a', '次の発言'), '成功');
});

test('画像履歴をモデルinputへ含め、追加質問でも同じ画像を参照する', async () => {
  const reads = [];
  const { ask, rememberImage } = loadModule('gpt.ts', {
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
              ['data:image/png;base64,second', 'data:image/png;base64,third'],
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

test('受信時の画像取得失敗を履歴で案内し、再送後はメモリの画像だけで回答する', async () => {
  let reads = 0;
  const { ask, rememberImage } = loadModule('gpt.ts', {
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
              assert.ok(
                request.input.some(
                  (m) => typeof m.content === 'string' && m.content.includes('送り直してください'),
                ),
              );
              return { output_text: '画像を送り直してください。' };
            }
            assert.equal(images.length, 1);
            return { output_text: '復帰' };
          },
        };
      }
    },
  });
  await rememberImage('recovery', 'expired');
  assert.match(await ask('recovery', '何が写ってる？'), /送り直して/);
  await rememberImage('recovery', 'resent');
  assert.equal(await ask('recovery', '何が写ってる？'), '復帰');
  assert.equal(await ask('recovery', 'もう一度'), '復帰');
  assert.equal(reads, 2);
});
