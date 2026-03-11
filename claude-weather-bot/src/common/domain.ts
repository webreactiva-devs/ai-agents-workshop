import { z } from 'zod';

export const weatherQueryInputSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  locationName: z.string().min(1),
  hoursAhead: z.number().int().min(1).max(24).default(6),
});

export const weatherCityInputSchema = z.object({
  locationName: z.string().min(1),
  hoursAhead: z.number().int().min(1).max(24).default(6),
});

export const weatherSnapshotSchema = z.object({
  locationName: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  temperatureC: z.number(),
  apparentTemperatureC: z.number(),
  precipitationProbability: z.number().min(0).max(100),
  windSpeedKph: z.number().nonnegative(),
  weatherCode: z.number(),
  isDay: z.boolean(),
  forecastWindow: z.object({
    start: z.string(),
    end: z.string(),
  }),
  source: z.literal('open-meteo'),
});

export const recommendationSignalsSchema = z.object({
  thermalLevel: z.enum(['cold', 'cool', 'mild', 'warm', 'hot']),
  rainLevel: z.enum(['dry', 'possible', 'likely']),
  windLevel: z.enum(['calm', 'breezy', 'windy']),
  umbrellaAdvice: z.enum(['no', 'optional', 'yes']),
  layeringAdvice: z.enum(['light', 'medium', 'heavy']),
  notes: z.array(z.string()),
});

export const userPreferenceProfileSchema = z.object({
  homeLocationName: z.string().min(1).optional(),
  homeLatitude: z.number().min(-90).max(90).optional(),
  homeLongitude: z.number().min(-180).max(180).optional(),
  coldSensitivity: z.enum(['low', 'medium', 'high']).default('medium'),
  commuteMode: z.enum(['walking', 'bike', 'car', 'public-transport']).default('walking'),
  hatesUmbrellas: z.boolean().default(false),
  responseStyle: z.enum(['brief', 'balanced', 'detailed']).default('balanced'),
});

export const dressRecommendationSchema = z.object({
  weatherSummary: z.string(),
  signals: recommendationSignalsSchema,
  clothing: z.object({
    upperBody: z.array(z.string()),
    lowerBody: z.array(z.string()),
    footwear: z.array(z.string()),
    accessories: z.array(z.string()),
  }),
  explanation: z.string(),
});

export type WeatherQueryInput = z.infer<typeof weatherQueryInputSchema>;
export type WeatherCityInput = z.infer<typeof weatherCityInputSchema>;
export type WeatherSnapshot = z.infer<typeof weatherSnapshotSchema>;
export type RecommendationSignals = z.infer<typeof recommendationSignalsSchema>;
export type UserPreferenceProfile = z.infer<typeof userPreferenceProfileSchema>;
export type DressRecommendation = z.infer<typeof dressRecommendationSchema>;
