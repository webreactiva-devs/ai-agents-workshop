import { createMastraRuntime } from '@agents-mastra/weather-common';
import { weatherPolicyAgent } from './agents/weather-policy-agent';

export const mastra = createMastraRuntime({
  appId: 'weather-policy',
  agents: { weatherPolicyAgent },
  server: {
    cors: { origin: '*' },
  },
});
