const assert = require('node:assert/strict');
const test = require('node:test');
const { loadModule } = require('../helpers.cjs');
const { ChatClientError } = require('../../src/clients/chat');

test('SDKの例外を名前・コード・タイムアウト判定だけの安全なエラーへ変換する', async () => {
  const OpenAI = require('openai');
  const { createOpenAIChatClient } = loadModule('clients/openai-chat.ts', {
    openai: {
      ...OpenAI,
      __esModule: true,
      default: class {
        constructor() {
          this.responses = {
            create: async () => {
              const error = new Error('secret-body');
              error.name = 'ProviderFailure';
              error.code = 'insufficient_quota';
              error.headers = { Authorization: 'secret-token' };
              throw error;
            },
          };
        }
      },
    },
  });
  const chat = createOpenAIChatClient({
    apiKey: 'test-key',
    model: 'model',
    instructions: 'instructions',
  });
  await assert.rejects(chat.reply([{ role: 'user', content: '質問' }]), (error) => {
    assert.ok(error instanceof ChatClientError);
    assert.equal(error.name, 'ProviderFailure');
    assert.equal(error.code, 'insufficient_quota');
    assert.equal(error.timedOut, false);
    assert.equal(error.cause, undefined);
    assert.equal(error.headers, undefined);
    assert.doesNotMatch(error.message + JSON.stringify(error), /secret-/);
    return true;
  });
});
