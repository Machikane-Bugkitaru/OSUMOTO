export type Message = {
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
  imageMessage?: boolean;
};
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
  maxImageBytes?: number;
};

export function createConversationHistory({
  limit,
  maxGroups = 1000,
  ttlMs = 30 * 60 * 1000,
  now = Date.now,
  maxImageBytes = 64 * 1024 * 1024,
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
        if (!message.imageMessage || ++images <= 1) return message;
        return {
          role: message.role,
          content: '[画像（参照対象の直近1枚より前）]',
          imageMessage: true,
        };
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
    respond: (messages: Message[]) => Promise<string>,
  ) =>
    withConversation(groupId, async (current) => {
      const question: Message = {
        role: 'user',
        content: typeof content === 'string' ? content : await content(),
      };
      const messages = retainedLimit === 0 ? [question] : bound([...current.messages, question]);
      const reply = await respond(messages);
      if (!reply.trim()) throw new Error('回答が空でした。');
      current.messages = bound([
        ...current.messages,
        question,
        { role: 'assistant', content: reply },
      ]);
      return reply;
    });

  const rememberImage = (groupId: string, image: string | (() => Promise<string>) | undefined) =>
    withConversation(groupId, async (current) => {
      if (retainedLimit === 0) return;
      let imageUrl: string | undefined;
      try {
        imageUrl = typeof image === 'function' ? await image() : image;
      } catch {
        // 受信時の取得失敗は質問時に再取得せず、画像再送で復帰できる履歴として残す。
      }
      current.messages = bound([
        ...current.messages,
        {
          role: 'user',
          content: imageUrl ? '[画像]' : '[画像（取得できません。画像を送り直してください）]',
          imageUrl,
          imageMessage: true,
        },
      ]);

      // グループ数に伴い画像本体の保持量が増え続けないよう、プロセス全体にも上限を設ける。
      current.lastUsed = now();
      const groups = [...conversations.values()];
      let size = groups.reduce(
        (total, group) =>
          total +
          group.messages.reduce((bytes, message) => bytes + (message.imageUrl?.length ?? 0), 0),
        0,
      );
      for (const group of groups.sort((a, b) => a.lastUsed - b.lastUsed)) {
        group.messages = group.messages.map((message) => {
          if (size <= maxImageBytes || !message.imageUrl) return message;
          size -= message.imageUrl.length;
          return {
            role: message.role,
            content: '[画像（保持容量を超えたため削除。画像を送り直してください）]',
            imageMessage: true,
          };
        });
      }
    });

  return Object.assign(ask, { rememberImage });
}
