const assert = require('node:assert/strict');
const test = require('node:test');
require('ts-node/register/transpile-only');
const { createEventDeduplicator } = require('../src/deduplication');

test('同時に受信した同じIDの処理を共有し、完了後も再実行しない', async () => {
  const once = createEventDeduplicator();
  let count = 0;
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const process = async () => {
    count += 1;
    await gate;
  };
  const first = once('event', process);
  const second = once('event', process);
  assert.equal(first, second);
  release();
  await Promise.all([first, second]);
  await once('event', process);
  assert.equal(count, 1);
});

test('別IDとIDのないイベントは個別に処理する', async () => {
  const once = createEventDeduplicator();
  let count = 0;
  for (const id of ['a', 'b', undefined, undefined]) {
    await once(id, async () => {
      count += 1;
    });
  }
  assert.equal(count, 4);
});

test('失敗しても同じIDで生成を再実行せず、元の失敗を返す', async () => {
  const once = createEventDeduplicator();
  let count = 0;
  const error = new Error('返信の失敗');
  const process = async () => {
    count += 1;
    throw error;
  };
  await assert.rejects(once('event', process), (actual) => actual === error);
  await assert.rejects(once('event', process), (actual) => actual === error);
  assert.equal(count, 1);
  await once('another', async () => {});
});

test('処理中は期限切れにせず、完了から保持期限を数える', async () => {
  let time = 0;
  const once = createEventDeduplicator({ ttlMs: 100, now: () => time });
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const first = once('a', async () => {
    await gate;
  });
  time = 1000;
  assert.equal(
    once('a', async () => assert.fail('重複')),
    first,
  );
  release();
  await first;
  time = 1099;
  await once('a', async () => assert.fail('期限内'));
  time = 1100;
  let ran = false;
  await once('a', async () => {
    ran = true;
  });
  assert.equal(ran, true);
});

test('上限で既存IDを追い出さず新規を拒否し、期限後に空きを回収する', async () => {
  let time = 0;
  const once = createEventDeduplicator({ ttlMs: 100, maxEntries: 1, now: () => time });
  await once('a', async () => {});
  await assert.rejects(
    once('b', async () => assert.fail('上限で実行してはいけない')),
    /保持上限/,
  );
  await once('a', async () => assert.fail('保持済み'));
  time = 100;
  await once('b', async () => {});
});
