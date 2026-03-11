import { Agent } from '@mastra/core/agent';
import { createWeatherInstructions, getDefaultModel, getWeatherByCityTool, weatherRequestContextSchema } from '@agents-mastra/weather-common';

export const weatherBasicAgent = new Agent({
  id: 'weather-basic-agent',
  name: 'Weather Basic Agent',
  description: 'Single-agent weather chatbot with one weather tool.',
  model: getDefaultModel(),
  instructions: createWeatherInstructions({
    includePolicy: false,
    includeMemory: false,
    mentionSkill: false,
    mentionMcp: false,
    mentionTrace: false,
  }),
  requestContextSchema: weatherRequestContextSchema,
  tools: {
    getWeatherByCityTool,
  },
});
