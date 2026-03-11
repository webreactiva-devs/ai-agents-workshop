import { z } from 'zod';
import { toolTrace } from './tool-trace.js';

// Import from parent project's common modules
import { weatherQueryInputSchema, weatherCityInputSchema } from '../../src/common/domain.js';
import { fetchWeatherSnapshot } from '../../src/common/open-meteo.js';
import { resolveLocation } from '../../src/common/geocode.js';

export const tracedTools = {
  'get-weather': {
    description: 'Get weather data from Open-Meteo for a known location and time window.',
    inputSchema: weatherQueryInputSchema,
    execute: async (input: z.infer<typeof weatherQueryInputSchema>) => {
      toolTrace('get-weather', 'call', {
        latitude: input.latitude,
        longitude: input.longitude,
        locationName: input.locationName,
      });
      try {
        const snapshot = await fetchWeatherSnapshot(input);
        toolTrace('get-weather', 'result', {
          temperatureC: snapshot.temperatureC,
          precipitationProbability: snapshot.precipitationProbability,
        });
        return snapshot;
      } catch (err) {
        toolTrace('get-weather', 'error', { error: String(err) });
        throw err;
      }
    },
  },

  'get-weather-by-city': {
    description: 'Get weather data from Open-Meteo for a city name and time window.',
    inputSchema: weatherCityInputSchema,
    execute: async (input: z.infer<typeof weatherCityInputSchema>) => {
      toolTrace('get-weather-by-city', 'call', { locationName: input.locationName, hoursAhead: input.hoursAhead });
      try {
        const resolved = resolveLocation(input.locationName);
        toolTrace('get-weather-by-city', 'result', {
          step: 'location-resolved',
          resolved: resolved.locationName,
          lat: resolved.latitude,
          lon: resolved.longitude,
        });
        const snapshot = await fetchWeatherSnapshot({ ...resolved, hoursAhead: input.hoursAhead });
        toolTrace('get-weather-by-city', 'result', {
          step: 'weather-fetched',
          temperatureC: snapshot.temperatureC,
          precipitationProbability: snapshot.precipitationProbability,
        });
        return snapshot;
      } catch (err) {
        toolTrace('get-weather-by-city', 'error', { error: String(err) });
        throw err;
      }
    },
  },
};
