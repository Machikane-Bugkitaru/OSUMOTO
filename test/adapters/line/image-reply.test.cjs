const assert = require('node:assert/strict');
const test = require('node:test');
require('../../helpers.cjs');
const { createImageReply } = require('../../../src/adapters/line/image-reply');
const { ImageClientError } = require('../../../src/image-error');

test('画像URLをLINEの画像返信へ変換する', async () => {
  const reply = createImageReply(async () => 'https://example.com/猫.png');
  const url = encodeURI('https://example.com/猫.png');
  assert.deepEqual(await reply('猫'), {
    type: 'image',
    originalContentUrl: url,
    previewImageUrl: url,
  });
});

test('正規化されたタイムアウトを既存の失敗返信へ変換する', async () => {
  let attempts = 0;
  const reply = createImageReply(async () => {
    attempts++;
    throw new ImageClientError(new Error('secret'), true);
  });
  assert.deepEqual(await reply('猫'), {
    type: 'text',
    text: '時間かかって失敗したわ。もっかいたのむで。',
  });
  assert.equal(attempts, 1);
});
