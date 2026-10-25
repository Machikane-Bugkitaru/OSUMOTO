import { load } from 'ts-dotenv';

export const loadServerConfig = () => {
  const env = load({ PORT: String });
  return { port: env.PORT || 3000, local: process.env.NODE_ENV === 'local' };
};
