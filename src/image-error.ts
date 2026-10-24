export class GeneratedImageUnavailableError extends Error {}

const property = (value: unknown, key: string): unknown =>
  typeof value === 'object' && value !== null && key in value
    ? (value as Record<string, unknown>)[key]
    : undefined;

export class ImageStorageError extends Error {
  readonly capacityExceeded: boolean;

  constructor(error: unknown) {
    super('画像の保存に失敗しました。');
    const responseError = property(property(property(error, 'response'), 'data'), 'error');
    const errors = property(responseError, 'errors');
    this.capacityExceeded =
      Array.isArray(errors) &&
      errors.some((entry: unknown) => property(entry, 'reason') === 'storageQuotaExceeded');
  }
}
