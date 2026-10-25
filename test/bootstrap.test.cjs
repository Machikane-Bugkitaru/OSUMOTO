const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');

test('画像単独の設定で初期化でき、会話・LINEの設定や通信を要求しない', () => {
  const run = spawnSync(
    process.execPath,
    [
      '-r',
      'ts-node/register/transpile-only',
      '-e',
      `
    global.fetch = () => { throw new Error('network must not be called'); };
    const { generateArt } = require('./src/bootstrap');
    if (typeof generateArt !== 'function') throw new Error('missing image use case');
  `,
    ],
    {
      cwd: path.resolve(__dirname, '..'),
      env: { PATH: process.env.PATH, OPENAI_API_KEY: 'test-key', OPENAI_MODEL: 'test-model' },
      encoding: 'utf8',
    },
  );
  assert.equal(run.status, 0, run.stderr);
});
