import { createTool } from '@mastra/core/tools';
import {
  weatherQueryInputSchema,
  weatherCityInputSchema,
  weatherSnapshotSchema,
  fetchWeatherSnapshot,
  resolveLocation,
} from '@agents-mastra/weather-common';
import { toolTrace } from './tool-trace';

export const tracedGetWeatherTool = createTool({
  id: 'get-weather',
  description: 'Get weather data from Open-Meteo for a known location and time window.',
  inputSchema: weatherQueryInputSchema,
  outputSchema: weatherSnapshotSchema,
  execute: async input => {
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
});

export const tracedGetWeatherByCityTool = createTool({
  id: 'get-weather-by-city',
  description: 'Get weather data from Open-Meteo for a city name and time window.',
  inputSchema: weatherCityInputSchema,
  outputSchema: weatherSnapshotSchema,
  execute: async ({ locationName, hoursAhead }) => {
    toolTrace('get-weather-by-city', 'call', { locationName, hoursAhead });
    try {
      const resolved = resolveLocation(locationName);
      toolTrace('get-weather-by-city', 'result', {
        step: 'location-resolved',
        resolved: resolved.locationName,
        lat: resolved.latitude,
        lon: resolved.longitude,
      });
      const snapshot = await fetchWeatherSnapshot({ ...resolved, hoursAhead });
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
});
