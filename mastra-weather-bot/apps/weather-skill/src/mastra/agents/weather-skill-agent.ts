import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import {
  createWeatherInstructions,
  deriveSignalsTool,
  getDefaultModel,
  getWeatherByCityTool,
  recommendClothingTool,
  weatherRequestContextSchema,
} from '@agents-mastra/weather-common';

export const weatherSkillAgent = new Agent({
  id: 'weather-skill-agent',
  name: 'Weather Skill Agent',
  description: 'Weather chatbot that complements policy rules with a reusable workspace skill.',
  model: getDefaultModel(),
  instructions: createWeatherInstructions({
    includePolicy: true,
    includeMemory: true,
    mentionSkill: false,
    mentionMcp: false,
    mentionTrace: false,
  }),
  requestContextSchema: weatherRequestContextSchema,
  tools: {
    getWeatherByCityTool,
    deriveSignalsTool,
    recommendClothingTool,
  },
  memory: new Memory(),
});
