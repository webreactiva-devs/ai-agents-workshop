import { weatherQueryInputSchema, weatherSnapshotSchema, type WeatherQueryInput, type WeatherSnapshot } from './domain';

const HOURLY_VARIABLES = ['temperature_2m', 'apparent_temperature', 'precipitation_probability', 'wind_speed_10m', 'weather_code', 'is_day'];

type OpenMeteoResponse = {
  hourly: {
    time: string[];
    temperature_2m: number[];
    apparent_temperature: number[];
    precipitation_probability: number[];
    wind_speed_10m: number[];
    weather_code: number[];
    is_day: number[];
  };
};

export async function fetchWeatherSnapshot(input: WeatherQueryInput): Promise<WeatherSnapshot> {
  const parsed = weatherQueryInputSchema.parse(input);
  const baseUrl = process.env.OPEN_METEO_BASE_URL ?? 'https://api.open-meteo.com/v1/forecast';
  const params = new URLSearchParams({
    latitude: String(parsed.latitude),
    longitude: String(parsed.longitude),
    hourly: HOURLY_VARIABLES.join(','),
    forecast_days: '2',
    timezone: 'auto',
  });

  const response = await fetch(`${baseUrl}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Open-Meteo request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as OpenMeteoResponse;
  const now = Date.now();
  const maxWindowMs = parsed.hoursAhead * 60 * 60 * 1000;

  const candidateIndexes = payload.hourly.time
    .map((time, index) => ({ index, delta: new Date(time).getTime() - now }))
    .filter(item => item.delta >= 0 && item.delta <= maxWindowMs);

  const index = candidateIndexes.length > 0 ? candidateIndexes[0].index : 0;

  return weatherSnapshotSchema.parse({
    locationName: parsed.locationName,
    latitude: parsed.latitude,
    longitude: parsed.longitude,
    temperatureC: payload.hourly.temperature_2m[index],
    apparentTemperatureC: payload.hourly.apparent_temperature[index],
    precipitationProbability: payload.hourly.precipitation_probability[index],
    windSpeedKph: payload.hourly.wind_speed_10m[index],
    weatherCode: payload.hourly.weather_code[index],
    isDay: payload.hourly.is_day[index] === 1,
    forecastWindow: {
      start: payload.hourly.time[index],
      end: payload.hourly.time[Math.min(index + Math.max(parsed.hoursAhead - 1, 0), payload.hourly.time.length - 1)],
    },
    source: 'open-meteo',
  });
}
