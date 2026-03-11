import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { resolveLocation } from './geocode.js';
import { fetchWeatherSnapshot } from './open-meteo.js';
import { deriveRecommendationSignals, createDeterministicRecommendation } from './policy.js';
import { weatherSnapshotSchema, userPreferenceProfileSchema } from './domain.js';
import type { Logger } from './logger.js';

export function createWeatherTools(logger?: Logger) {
  const getWeatherByCity = tool(
    'getWeatherByCity',
    'Get weather data from Open-Meteo for a city name and time window.',
    {
      locationName: z.string().describe('City name, e.g. "Madrid"'),
      hoursAhead: z.number().int().min(1).max(24).default(6).describe('Hours ahead to forecast'),
    },
    async (args) => {
      logger?.info('tool:getWeatherByCity', { locationName: args.locationName, hoursAhead: args.hoursAhead });
      const resolved = resolveLocation(args.locationName);
      const snapshot = await fetchWeatherSnapshot({ ...resolved, hoursAhead: args.hoursAhead });
      logger?.info('tool:getWeatherByCity:result', { temperatureC: snapshot.temperatureC });
      return { content: [{ type: 'text' as const, text: JSON.stringify(snapshot, null, 2) }] };
    },
  );

  const deriveSignals = tool(
    'deriveSignals',
    'Convert raw weather data and optional user preferences into recommendation signals (thermal, rain, wind levels).',
    {
      weather: weatherSnapshotSchema.describe('Weather snapshot from getWeatherByCity'),
      preferences: userPreferenceProfileSchema.partial().optional().describe('Optional user preferences'),
    },
    async (args) => {
      logger?.info('tool:deriveSignals', { location: args.weather.locationName });
      const signals = deriveRecommendationSignals(args.weather, args.preferences);
      logger?.info('tool:deriveSignals:result', { thermalLevel: signals.thermalLevel });
      return { content: [{ type: 'text' as const, text: JSON.stringify(signals, null, 2) }] };
    },
  );

  const recommendClothing = tool(
    'recommendClothing',
    'Generate a deterministic clothing recommendation from weather data and optional user preferences.',
    {
      weather: weatherSnapshotSchema.describe('Weather snapshot from getWeatherByCity'),
      preferences: userPreferenceProfileSchema.partial().optional().describe('Optional user preferences'),
    },
    async (args) => {
      logger?.info('tool:recommendClothing', { location: args.weather.locationName });
      const recommendation = createDeterministicRecommendation(args.weather, args.preferences);
      logger?.info('tool:recommendClothing:result', { clothing: recommendation.clothing });
      return { content: [{ type: 'text' as const, text: JSON.stringify(recommendation, null, 2) }] };
    },
  );

  return { getWeatherByCity, deriveSignals, recommendClothing };
}
