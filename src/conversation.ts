export type Message = { role: 'user' | 'assistant'; content: string; imageId?: string };
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
  const retainedLimit = Math.min(limit, 10);
  const bound = (messages: Message[]): Message[] => {
    if (retainedLimit === 0) return [];
    let images = 0;
    // 先に10件の窓を確定し、古い画像を除いても窓の外から補充しない。
    return messages
      .slice(-retainedLimit)
      .reverse()
      .map((message) => {
        if (!message.imageId || ++images <= 2) return message;
        return { role: message.role, content: '[画像（参照対象の直近2枚より前）]' };
      })
      .reverse();
  };

  async function withConversation<T>(
    groupId: string,
    work: (conversation: Conversation) => Promise<T>,
  ): Promise<T> {
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
    const result = current.tail.then(() => work(current));
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
  }

  const ask = (
    groupId: string,
    content: string | (() => Promise<string>),
    respond: (messages: Message[], invalidateImage: (imageId: string) => void) => Promise<string>,
  ) =>
    withConversation(groupId, async (current) => {
      const question: Message = {
        role: 'user',
        content: typeof content === 'string' ? content : await content(),
      };
      const messages = retainedLimit === 0 ? [question] : bound([...current.messages, question]);
      const reply = await respond(messages, (imageId) => {
        // 取得不能な画像で再送後の会話まで失敗し続けないよう、参照だけを無効化する。
        current.messages = current.messages.map((message) =>
          message.imageId === imageId
            ? { role: message.role, content: '[画像（取得できません。画像を送り直してください）]' }
            : message,
        );
      });
      if (!reply.trim()) throw new Error('回答が空でした。');
      current.messages = bound([...messages, { role: 'assistant', content: reply }]);
      return reply;
    });

  const rememberImage = (groupId: string, imageId?: string) =>
    withConversation(groupId, async (current) => {
      current.messages = bound([
        ...current.messages,
        {
          role: 'user',
          content: imageId ? '[画像]' : '[画像（読み取り未対応。画像を送り直してください）]',
          imageId,
        },
      ]);
    });

  return Object.assign(ask, { rememberImage });
}
