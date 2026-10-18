const Module = require('node:module');
const path = require('node:path');
require('ts-node/register/transpile-only');
const { load } = require('ts-dotenv');

const env = {
  OPENAI_API_KEY: 'test-key',
  OPENAI_MODEL: 'test-model',
  SYSTEM_SETTINGS: 'test settings',
  MESSAGE_HISTORY_LIMIT: '10',
  CHANNEL_ACCESS_TOKEN: 'test-token',
  CHANNEL_SECRET: 'test-secret',
  CHANNEL_BOT_NAME: 'BOT',
  PORT: '3000',
};

function loadModule(file, mocks) {
  const filename = path.resolve(__dirname, '../src', file);
  const originalLoad = Module._load;
  const originalEnv = { ...process.env };
  Object.assign(process.env, env);
  delete process.env.OPENAI_IMAGE_MODEL;
  delete require.cache[filename];
  Module._load = function (request, parent, isMain) {
    if (parent?.filename === filename) {
      if (Object.hasOwn(mocks, request)) return mocks[request];
      if (request === 'ts-dotenv') {
        return { load: (schema) => load(schema, path.join(__dirname, 'missing.env')) };
      }
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    return require(filename);
  } finally {
    Module._load = originalLoad;
    process.env = originalEnv;
  }
}

module.exports = { loadModule };
