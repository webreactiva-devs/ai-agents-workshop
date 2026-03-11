import { createStep, createWorkflow } from '@mastra/core/workflows';
import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY } from '@mastra/core/request-context';
import { z } from 'zod';
import {
  clarityScorer,
  personalizationScorer,
  prudenceScorer,
  utilityScorer,
  weatherCoherenceScorer,
  weatherCityInputSchema,
} from '@agents-mastra/weather-common';
import { weatherInterpreterAgent, weatherInterpreterOutputSchema } from '../agents/weather-interpreter-agent';
import { weatherRecommenderAgent } from '../agents/weather-recommender-agent';

function resolveMemoryContext(
  requestContext: { get: (key: string) => unknown },
  suffix: string,
) {
  const thread = requestContext.get(MASTRA_THREAD_ID_KEY);
  const resource = requestContext.get(MASTRA_RESOURCE_ID_KEY);

  return {
    thread: typeof thread === 'string' && thread.length > 0 ? `${thread}:${suffix}` : `workflow-${suffix}`,
    resource: typeof resource === 'string' && resource.length > 0 ? resource : 'weather-dual-agent-eval',
  };
}

const interpretWeatherStep = createStep({
  id: 'interpret-weather',
  inputSchema: weatherCityInputSchema,
  outputSchema: weatherInterpreterOutputSchema,
  execute: async ({ inputData, requestContext }) => {
    const result = await weatherInterpreterAgent.generate(
      `Interpret the weather for ${inputData.locationName} in the next ${inputData.hoursAhead} hours.`,
      {
        memory: resolveMemoryContext(requestContext, 'interpret-weather'),
        requestContext,
        structuredOutput: {
          schema: weatherInterpreterOutputSchema,
        },
      },
    );

    if (!result.object) {
      throw new Error('Weather interpreter did not return structured output.');
    }

    return result.object;
  },
});

const recommendClothingStep = createStep({
  id: 'recommend-clothing',
  inputSchema: weatherInterpreterOutputSchema,
  outputSchema: z.object({
    recommendation: z.string(),
  }),
  execute: async ({ inputData, requestContext }) => {
    const result = await weatherRecommenderAgent.generate(
      [
        {
          role: 'user',
          content: `Weather summary: ${inputData.summary}. Signals: ${JSON.stringify(inputData.signals)}. Weather data: ${JSON.stringify(inputData.weather)}.`,
        },
      ],
      {
        memory: resolveMemoryContext(requestContext, 'recommend-clothing'),
        requestContext,
        scorers: {
          utility: { scorer: utilityScorer.name },
          coherence: { scorer: weatherCoherenceScorer.name },
          personalization: { scorer: personalizationScorer.name },
          prudence: { scorer: prudenceScorer.name },
          clarity: { scorer: clarityScorer.name },
        },
        returnScorerData: true,
      },
    );

    return {
      recommendation: result.text,
    };
  },
});

export const weatherAdviceWorkflow = createWorkflow({
  id: 'weather-advice-workflow',
  description:
    'Use this workflow when the user wants clothing advice for a city and time window. It first interprets the weather into structured signals and then generates the final clothing recommendation with evaluation scorers.',
  inputSchema: weatherCityInputSchema,
  outputSchema: z.object({
    recommendation: z.string(),
  }),
})
  .then(interpretWeatherStep)
  .then(recommendClothingStep)
  .commit();
