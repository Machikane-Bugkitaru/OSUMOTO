const assert = require('node:assert/strict');
const test = require('node:test');
require('../../helpers.cjs');
const { createChatReply, createChatAnswer } = require('../../../src/adapters/line/chat-reply');
const { ChatClientError } = require('../../../src/clients/chat');

for (const [answer, text] of [
  ['  回答  ', '回答'],
  ['BOT： 回答 ', '回答'],
  ['BOT: 回答', '回答'],
  ['BOT:', ''],
]) {
  test(`既存の接頭辞・空白の返信整形を維持する: ${JSON.stringify(answer)}`, async () => {
    let getNames = 0;
    const reply = createChatReply({
      botName: 'BOT',
      getSenderName: async () => {
        getNames++;
        return '名前';
      },
      ask: async (groupId, content) => {
        assert.equal(groupId, 'group');
        assert.equal(getNames, 0);
        assert.equal(await content(), '名前:BOT質問');
        return answer;
      },
    });
    assert.deepEqual(await reply('user', 'group', 'BOT質問'), { type: 'text', text });
    assert.equal(getNames, 1);
  });
}

test('返信用の失敗文言を履歴処理が完了した後で生成する', async () => {
  const error = new ChatClientError('Error', undefined, true);
  const ask = createChatAnswer(async () => {
    throw error;
  });
  assert.equal(await ask('group', '質問'), '時間かかって失敗したわ。もっかいたのむで。');
});
