import { Client } from '@line/bot-sdk';

export type LineMessage =
  | { type: 'text'; text: string }
  | {
      type: 'image';
      originalContentUrl: string;
      previewImageUrl: string;
    };

export interface LineClient {
  replyMessage(token: string, message: LineMessage): Promise<void>;
  getGroupMemberProfile(
    groupId: string,
    userId: string,
  ): Promise<{ displayName: string } | undefined>;
}

export const createLineClient = (config: {
  channelAccessToken: string;
  channelSecret: string;
}): LineClient => {
  const client = new Client(config);
  return {
    async replyMessage(token, message) {
      await client.replyMessage(token, message);
    },
    async getGroupMemberProfile(groupId, userId) {
      const profile = await client.getGroupMemberProfile(groupId, userId);
      return profile ? { displayName: profile.displayName } : undefined;
    },
  };
};
