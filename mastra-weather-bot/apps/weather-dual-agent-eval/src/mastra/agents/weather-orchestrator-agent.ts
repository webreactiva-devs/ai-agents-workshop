import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { createWeatherInstructions, getDefaultModel, weatherRequestContextSchema } from '@agents-mastra/weather-common';
import { weatherAdviceWorkflow } from '../workflows/weather-advice-workflow';

export const weatherOrchestratorAgent = new Agent({
  id: 'weather-orchestrator-agent',
  name: 'Weather Orchestrator Agent',
  description: 'Main chatbot that gathers missing weather query details and calls the weather advice workflow when ready.',
  model: getDefaultModel(),
  instructions: createWeatherInstructions({
    includePolicy: true,
    includeMemory: true,
    mentionSkill: false,
    mentionMcp: false,
    mentionTrace: true,
  }),
  requestContextSchema: weatherRequestContextSchema,
  workflows: {
    weatherAdvice: weatherAdviceWorkflow,
  },
  memory: new Memory(),
});
