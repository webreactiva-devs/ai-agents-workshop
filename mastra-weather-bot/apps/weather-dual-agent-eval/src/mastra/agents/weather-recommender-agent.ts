import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import {
  createWeatherInstructions,
  getDefaultModel,
  recommendClothingTool,
  weatherRequestContextSchema,
} from '@agents-mastra/weather-common';

export const weatherRecommenderAgent = new Agent({
  id: 'weather-recommender-agent',
  name: 'Weather Recommender Agent',
  description: 'Specialist agent that turns structured weather context into clothing advice.',
  model: getDefaultModel(),
  instructions: createWeatherInstructions({
    includePolicy: true,
    includeMemory: true,
    mentionSkill: false,
    mentionMcp: false,
    mentionTrace: true,
    isRecommender: true,
  }),
  requestContextSchema: weatherRequestContextSchema,
  tools: {
    recommendClothingTool,
  },
  memory: new Memory(),
});
