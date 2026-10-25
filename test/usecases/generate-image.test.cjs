const assert = require('node:assert/strict');
const test = require('node:test');
require('../helpers.cjs');
const { createGenerateImage } = require('../../src/usecases/generate-image');

test('準備と生成で40秒を共有し、残り時間と準備済みの指示を生成へ渡す', async () => {
  let time = 100;
  const calls = [];
  const generate = createGenerateImage({
    now: () => time,
    images: {
      async preparePrompt(prompt) {
        calls.push(['prepare', prompt]);
        time += 12_000;
        return '  prepared prompt  ';
      },
      async generateImage(prompt, timeout) {
        calls.push(['generate', prompt, timeout]);
        return 'png';
      },
    },
    storage: {
      async storeImage(name, data) {
        calls.push(['store', name, data]);
        return 'image-url';
      },
    },
  });
  assert.equal(await generate('original long prompt'), 'image-url');
  assert.deepEqual(calls, [
    ['prepare', 'original long prompt'],
    ['generate', 'prepared prompt', 28_000],
    ['store', 'original l', 'png'],
  ]);
});

test('共有予算がちょうど尽きた場合も生成と保存を呼ばない', async () => {
  let time = 0;
  const generate = createGenerateImage({
    now: () => time,
    images: {
      async preparePrompt() {
        time = 40_000;
        return 'cat';
      },
      generateImage: () => assert.fail('生成しない'),
    },
    storage: { storeImage: () => assert.fail('保存しない') },
  });
  await assert.rejects(generate('cat'), /制限時間/);
});
