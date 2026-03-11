import { createMastraRuntime } from '@agents-mastra/weather-common';
import { weatherMemoryAgent } from './agents/weather-memory-agent';

export const mastra = createMastraRuntime({
  appId: 'weather-memory',
  agents: { weatherMemoryAgent },
  server: {
    cors: { origin: '*' },
  },
  defaultChatOptions: {
    resourceId: 'playground-user',
  },
});
