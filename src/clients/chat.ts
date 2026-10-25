import type { Message } from '../conversation';

export interface ChatClient {
  reply(messages: Message[]): Promise<string>;
}

// Carry only the fields needed for existing diagnostics and reply selection.
export class ChatClientError extends Error {
  constructor(
    name: string,
    readonly code: string | undefined,
    readonly timedOut: boolean,
  ) {
    super('会話処理の通信に失敗しました。');
    this.name = name;
  }
}
