const { loadModule } = require('./helpers.cjs');

function loadLineModule(mocks) {
  return loadModule('line.ts', {
    ...mocks,
    './bootstrap': { createChatServices: () => mocks['./bootstrap'] },
    './line-image': {
      readLineImage: () => {
        throw new Error('画像取得を呼んではいけない');
      },
    },
  });
}
module.exports = { loadLineModule };
