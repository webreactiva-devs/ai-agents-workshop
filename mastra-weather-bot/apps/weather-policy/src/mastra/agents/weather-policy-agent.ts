import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import {
  createWeatherInstructions,
  deriveSignalsTool,
  getDefaultModel,
  getWeatherByCityTool,
  recommendClothingTool,
  weatherInputGuardrail,
  weatherOutputGuardrail,
  weatherRequestContextSchema,
} from '@agents-mastra/weather-common';

export const weatherPolicyAgent = new Agent({
  id: 'weather-policy-agent',
  name: 'Weather Policy Agent',
  description: 'Single-agent weather chatbot with explicit policy tools and guardrails.',
  model: getDefaultModel(),
  instructions: createWeatherInstructions({
    includePolicy: true,
    includeMemory: false,
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
  inputProcessors: [weatherInputGuardrail],
  outputProcessors: [weatherOutputGuardrail],
  maxProcessorRetries: 1,
});
