import { createMastraRuntime } from '@agents-mastra/weather-common';
import { weatherSkillAgent } from './agents/weather-skill-agent';

export const mastra = createMastraRuntime({
  appId: 'weather-skill',
  agents: { weatherSkillAgent },
  server: {
    cors: { origin: '*' },
  },
});
