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
    const generateArt = require('./src/bootstrap').createImageGeneration();
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

test('HTTPアプリを組み立てても通信せず、indexが同じappを名前付き・defaultで公開する', () => {
  const run = spawnSync(
    process.execPath,
    [
      '-r',
      'ts-node/register/transpile-only',
      '-e',
      `
    global.fetch = () => { throw new Error('network must not be called'); };
    const entry = require('./src/index');
    if (typeof entry.app !== 'function' || entry.default !== entry.app) throw new Error('invalid app exports');
  `,
    ],
    {
      cwd: path.resolve(__dirname, '..'),
      env: {
        PATH: process.env.PATH,
        OPENAI_API_KEY: 'test-key',
        OPENAI_MODEL: 'test-model',
        SYSTEM_SETTINGS: 'test settings',
        CHANNEL_ACCESS_TOKEN: 'test-token',
        CHANNEL_SECRET: 'test-secret',
        CHANNEL_BOT_NAME: 'BOT',
        PORT: '3000',
      },
      encoding: 'utf8',
    },
  );
  assert.equal(run.status, 0, run.stderr);
});

test('会話単独の組み立てにもLINEや画像保存の設定を要求しない', () => {
  const run = spawnSync(
    process.execPath,
    [
      '-r',
      'ts-node/register/transpile-only',
      '-e',
      `
    global.fetch = () => { throw new Error('network must not be called'); };
    const chat = require('./src/bootstrap').createChatServices({ readImage: async () => 'image' });
    if (typeof chat.ask !== 'function' || typeof chat.rememberImage !== 'function') throw new Error('missing chat use cases');
  `,
    ],
    {
      cwd: path.resolve(__dirname, '..'),
      env: {
        PATH: process.env.PATH,
        OPENAI_API_KEY: 'test-key',
        OPENAI_MODEL: 'test-model',
        SYSTEM_SETTINGS: 'settings',
        GOOGLE_CREDENTIALS_JSON: 'invalid-but-unused',
      },
      encoding: 'utf8',
    },
  );
  assert.equal(run.status, 0, run.stderr);
});
