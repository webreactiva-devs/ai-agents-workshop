import { Agent } from '@mastra/core/agent';
import { z } from 'zod';
import {
  createWeatherInstructions,
  getDefaultModel,
  getWeatherByCityTool,
  recommendationSignalsSchema,
  weatherSnapshotSchema,
  weatherRequestContextSchema,
} from '@agents-mastra/weather-common';

export const weatherInterpreterOutputSchema = z.object({
  weather: weatherSnapshotSchema,
  signals: recommendationSignalsSchema,
  summary: z.string(),
});

export const weatherInterpreterAgent = new Agent({
  id: 'weather-interpreter-agent',
  name: 'Weather Interpreter Agent',
  description: 'Specialist agent that interprets weather into structured signals.',
  model: getDefaultModel(),
  instructions: createWeatherInstructions({
    includePolicy: true,
    includeMemory: false,
    mentionSkill: false,
    mentionMcp: false,
    mentionTrace: true,
    isWeatherInterpreter: true,
  }),
  requestContextSchema: weatherRequestContextSchema,
  tools: {
    getWeatherByCityTool,
  },
});
