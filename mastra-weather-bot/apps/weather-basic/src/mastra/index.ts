import { createMastraRuntime } from '@agents-mastra/weather-common';
import { weatherBasicAgent } from './agents/weather-basic-agent';

export const mastra = createMastraRuntime({
  appId: 'weather-basic',
  agents: { weatherBasicAgent },
  server: {
    cors: { origin: '*' },
  },
});
