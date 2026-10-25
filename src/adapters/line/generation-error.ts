import { APIConnectionTimeoutError } from 'openai';
import { ChatClientError } from '../../clients/chat';
import { ImageStorageError, ImageClientError } from '../../clients/image-generation';
import { GeneratedImageUnavailableError } from '../../usecases/image-error';

export const getGenerationErrorMessage = (error: unknown): string | undefined => {
  if (error instanceof ImageStorageError && error.capacityExceeded) {
    return 'おまいら画像生成しすぎて保存でけへんくなったわ。古いの消してくれ。';
  }
  if (error instanceof ImageStorageError || error instanceof GeneratedImageUnavailableError) {
    return '画像生成したけど内容どっかいったわ。もっかいたのむで。';
  }
  if (
    error instanceof APIConnectionTimeoutError ||
    ((error instanceof ImageClientError || error instanceof ChatClientError) && error.timedOut)
  ) {
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
