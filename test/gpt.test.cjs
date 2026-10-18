const assert = require('node:assert/strict');
const test = require('node:test');
const { loadModule } = require('./helpers.cjs');

test('チャットAPIにグループ別の履歴と既存のモデル設定を渡す', async () => {
  const inputs = [];
  const { ask } = loadModule('gpt.ts', {
    openai: class {
      constructor() {
        this.responses = {
          create: async (request) => {
            assert.equal(request.model, 'test-model');
            assert.equal(request.service_tier, 'priority');
            assert.deepEqual(request.input[0], { role: 'developer', content: 'test settings' });
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
    ['test settings', 'A'],
    ['test settings', 'B'],
    ['test settings', 'A', '回答1', 'A続き'],
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
