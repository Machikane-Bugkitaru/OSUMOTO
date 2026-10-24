import { APIConnectionTimeoutError } from 'openai';

export const getGenerationErrorMessage = (error: unknown): string | undefined => {
  if (error instanceof APIConnectionTimeoutError) {
    return '時間かかって失敗したわ。もっかいたのむで。';
  }
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  if (error.code === 'moderation_blocked') {
    return 'あかんプロンプトみたいや。他ので試してくれや。';
  }
  if (error.code === 'insufficient_quota') {
    return '金なくなったわ。恵んでくれや。';
  }
  return undefined;
};
