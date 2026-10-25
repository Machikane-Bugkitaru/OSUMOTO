import OpenAI, { APIConnectionTimeoutError } from 'openai';
import { toImageInput } from '../image-input';
import { ChatClientError, type ChatClient } from './chat';

interface Config {
  apiKey: string;
  model: string;
  instructions: string;
}

export const createOpenAIChatClient = (config: Config): ChatClient => {
  // Keep the chat SDK's existing timeout/retry defaults.
  const client = new OpenAI({ apiKey: config.apiKey || '' });
  return {
    async reply(messages) {
      try {
        const response = await client.responses.create({
          model: config.model,
          service_tier: 'priority',
          tools: [{ type: 'web_search' }],
          tool_choice: 'auto',
          input: [{ role: 'developer', content: config.instructions }, ...toImageInput(messages)],
        });
        return response.output_text;
      } catch (error: unknown) {
        const code =
          typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
        throw new ChatClientError(
          error instanceof Error ? error.name : 'UnknownError',
          typeof code === 'string' && /^[a-z][a-z0-9_]{0,63}$/.test(code) ? code : undefined,
          error instanceof APIConnectionTimeoutError,
        );
      }
    },
  };
};
