type Message = { role: 'user' | 'assistant'; content: string };
type Conversation = {
  messages: Message[];
  tail: Promise<void>;
  pending: number;
  lastUsed: number;
};

type HistoryOptions = {
  limit: number;
  maxGroups?: number;
  ttlMs?: number;
  now?: () => number;
};

export function createConversationHistory({
  limit,
  maxGroups = 1000,
  ttlMs = 30 * 60 * 1000,
  now = Date.now,
}: HistoryOptions) {
  if (!Number.isSafeInteger(limit) || limit < 0) {
    throw new Error('MESSAGE_HISTORY_LIMIT は0以上の整数を指定してください。');
  }
  const conversations = new Map<string, Conversation>();
  // 片方の発言だけが次の文脈に残らないよう、完了した会話のペアで保持する。
  const retainedLimit = Math.floor(limit / 2) * 2;

  return async (
    groupId: string,
    content: string,
    respond: (messages: Message[]) => Promise<string>,
  ): Promise<string> => {
    for (const [key, conversation] of conversations) {
      if (conversation.pending === 0 && now() - conversation.lastUsed >= ttlMs) {
        conversations.delete(key);
      }
    }

    let conversation = conversations.get(groupId);
    if (!conversation) {
      if (conversations.size >= maxGroups) {
        const oldest = [...conversations]
          .filter(([, value]) => value.pending === 0)
          .sort((a, b) => a[1].lastUsed - b[1].lastUsed)[0];
        if (!oldest) throw new Error('会話の同時処理数が上限に達しました。');
        conversations.delete(oldest[0]);
      }
      conversation = { messages: [], tail: Promise.resolve(), pending: 0, lastUsed: now() };
      conversations.set(groupId, conversation);
    }

    const current = conversation;
    current.pending += 1;
    // 同じグループの応答順を保ち、失敗した要求が後続の会話を止めないようにする。
    const result = current.tail.then(async () => {
      const previousLimit = Math.max(0, retainedLimit - 2);
      const previous = previousLimit === 0 ? [] : current.messages.slice(-previousLimit);
      const messages: Message[] = [...previous, { role: 'user', content }];
      const reply = await respond(messages);
      if (!reply.trim()) throw new Error('回答が空でした。');
      current.messages =
        retainedLimit === 0 ? [] : [...messages, { role: 'assistant', content: reply }];
      return reply;
    });
    current.tail = result.then(
      () => undefined,
      () => undefined,
    );
    try {
      return await result;
    } finally {
      current.pending -= 1;
      current.lastUsed = now();
    }
  };
}
