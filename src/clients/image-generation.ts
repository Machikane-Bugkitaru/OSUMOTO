// Application contracts use plain values; SDK request/response types stay in clients.
export interface ImageGenerationClient {
  preparePrompt(prompt: string): Promise<string>;
  generateImage(prompt: string, timeoutMs: number): Promise<string | undefined>;
}

export interface ImageStorageClient {
  storeImage(fileName: string, base64Data: string): Promise<string>;
}
