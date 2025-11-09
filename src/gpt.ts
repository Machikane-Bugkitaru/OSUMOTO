import { Configuration, OpenAIApi } from "openai";
import { load } from 'ts-dotenv';
const env = load({
  OPENAI_API_KEY: String,
  SYSTEM_SETTINGS: String,
});

const openai = new OpenAIApi(new Configuration({
  apiKey: env.OPENAI_API_KEY || '',
}));
const systemSettings = env.SYSTEM_SETTINGS

type Message = {
  role: "user" | "system" | "assistant";
  content: string;
};
const pastMessages: Message[] = [];

export async function ask(content: string): Promise<string> {
  if (pastMessages.length > 3) {
    pastMessages.shift()
  }
  pastMessages.push({role: "user", content: content});
  try {
    const completion = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [
        {role: "system", content: systemSettings},
        ...pastMessages,
      ],
    });

    return completion.data!.choices[0]!.message!.content || ''
  } catch (error: any) {
    if (!error && error.response) {
      return `${error.response.status}, ${error.response.data}`;
    } else {
      return `${error.type}, ${error.message}`;
    };
  };
};

export async function checkAsk(content: string) {
  if (pastMessages.length > 2) {
    pastMessages.shift()
  }
  pastMessages.push({role: "user", content: content});
  return [
    {role: "system", content: systemSettings},
    ...pastMessages,
  ]
}