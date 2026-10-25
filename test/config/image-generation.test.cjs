const assert = require('node:assert/strict');
const test = require('node:test');
const { loadModule } = require('../helpers.cjs');

test('画像生成設定は読み込み時に検証し、既定モデルと明示モデルを使う', () => {
  const previous = { ...process.env };
  const { loadImageGenerationConfig } = loadModule('config/image-generation.ts', {});
  try {
    process.env.OPENAI_API_KEY = 'key';
    process.env.OPENAI_MODEL = 'model';
    delete process.env.OPENAI_IMAGE_MODEL;
    assert.deepEqual(loadImageGenerationConfig(), {
      apiKey: 'key',
      promptModel: 'model',
      imageModel: 'gpt-image-2.5-flare',
    });
    process.env.OPENAI_IMAGE_MODEL = 'custom-image-model';
    assert.equal(loadImageGenerationConfig().imageModel, 'custom-image-model');
    delete process.env.OPENAI_MODEL;
    assert.throws(loadImageGenerationConfig, /OPENAI_MODEL/);
  } finally {
    process.env = previous;
  }
});
