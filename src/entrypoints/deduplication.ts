type Entry = { result: Promise<void>; expiresAt: number };

export function createEventDeduplicator({
  ttlMs = 60 * 60 * 1000,
  maxEntries = 10_000,
  now = Date.now,
}: { ttlMs?: number; maxEntries?: number; now?: () => number } = {}) {
  const entries = new Map<string, Entry>();

  return (eventId: string | undefined, process: () => Promise<void>): Promise<void> => {
    // 古いSDKに型定義がなくても実際のIDを使い、IDのないイベントは誤って同一視しない。
    if (!eventId) return process();
    for (const [key, entry] of entries) {
      if (entry.expiresAt <= now()) entries.delete(key);
    }
    const existing = entries.get(eventId);
    if (existing) return existing.result;

    // 処理中・完了済みのIDを追い出すと重複生成するため、上限時は新規処理を拒否する。
    if (entries.size >= maxEntries) {
      return Promise.reject(new Error('Webhook イベントの保持上限に達しました。'));
    }
    const entry: Entry = { result: Promise.resolve(), expiresAt: Infinity };
    entry.result = Promise.resolve()
      .then(process)
      .then(
        () => {
          entry.expiresAt = now() + ttlMs;
        },
        (error: unknown) => {
          // 返信失敗でも生成は完了済みかもしれないので、同じIDで有料APIを再実行しない。
          entry.expiresAt = now() + ttlMs;
          throw error;
        },
      );
    entries.set(eventId, entry);
    return entry.result;
  };
}
