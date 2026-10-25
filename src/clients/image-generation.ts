// Application contracts use plain values; SDK request/response types stay in clients.
export interface ImageGenerationClient {
  preparePrompt(prompt: string): Promise<string>;
  generateImage(prompt: string, timeoutMs: number): Promise<string | undefined>;
}

export interface ImageStorageClient {
  storeImage(fileName: string, base64Data: string): Promise<string>;
}

const property = (value: unknown, key: string): unknown =>
  typeof value === 'object' && value !== null && key in value
    ? (value as Record<string, unknown>)[key]
    : undefined;

// Normalized failures expose only safe scalar diagnostics across the client boundary.
export class ImageClientError extends Error {
  readonly errorType: string;
  readonly status: number | undefined;
  readonly code: string | undefined;

  constructor(
    error: unknown,
    readonly timedOut = false,
  ) {
    super('画像処理の通信に失敗しました。');
    this.errorType = error instanceof Error ? error.constructor.name : 'UnknownError';
    const status = property(error, 'status') ?? property(property(error, 'response'), 'status');
    this.status = typeof status === 'number' ? status : undefined;
    const code = property(error, 'code');
    this.code = typeof code === 'string' && /^[a-z][a-z0-9_]{0,63}$/.test(code) ? code : undefined;
  }
}

export class ImageStorageError extends ImageClientError {
  readonly capacityExceeded: boolean;

  constructor(error: unknown) {
    super(error);
    this.message = '画像の保存に失敗しました。';
    const responseError = property(property(property(error, 'response'), 'data'), 'error');
    const errors = property(responseError, 'errors');
    this.capacityExceeded =
      Array.isArray(errors) &&
      errors.some((entry: unknown) => property(entry, 'reason') === 'storageQuotaExceeded');
  }
}
