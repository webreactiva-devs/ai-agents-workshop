import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { createDeterministicRecommendation, deriveRecommendationSignals } from './policy';
import { fetchWeatherSnapshot } from './open-meteo';
import {
  dressRecommendationSchema,
  recommendationSignalsSchema,
  userPreferenceProfileSchema,
  weatherCityInputSchema,
  weatherQueryInputSchema,
  weatherSnapshotSchema,
} from './domain';
import { resolveLocation } from './location';

export const getWeatherTool = createTool({
  id: 'get-weather',
  description: 'Get weather data from Open-Meteo for a known location and time window.',
  inputSchema: weatherQueryInputSchema,
  outputSchema: weatherSnapshotSchema,
  execute: async input => fetchWeatherSnapshot(input),
});

export const getWeatherByCityTool = createTool({
  id: 'get-weather-by-city',
  description: 'Get weather data from Open-Meteo for a city name and time window.',
  inputSchema: weatherCityInputSchema,
  outputSchema: weatherSnapshotSchema,
  execute: async ({ locationName, hoursAhead }) => {
    const resolved = resolveLocation(locationName);
    return fetchWeatherSnapshot({
      ...resolved,
      hoursAhead,
    });
  },
});

export const deriveSignalsTool = createTool({
  id: 'derive-weather-signals',
  description: 'Convert raw weather data and user preferences into deterministic recommendation signals.',
  inputSchema: z.object({
    weather: weatherSnapshotSchema,
    preferences: userPreferenceProfileSchema.partial().optional(),
  }),
  outputSchema: recommendationSignalsSchema,
  execute: async ({ weather, preferences }) => deriveRecommendationSignals(weather, preferences),
});

export const recommendClothingTool = createTool({
  id: 'recommend-clothing',
  description: 'Generate a deterministic clothing recommendation from weather data and user preferences.',
  inputSchema: z.object({
    weather: weatherSnapshotSchema,
    preferences: userPreferenceProfileSchema.partial().optional(),
  }),
  outputSchema: dressRecommendationSchema,
  execute: async ({ weather, preferences }) => createDeterministicRecommendation(weather, preferences),
});
