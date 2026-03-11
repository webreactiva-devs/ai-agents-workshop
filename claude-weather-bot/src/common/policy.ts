import {
  dressRecommendationSchema,
  recommendationSignalsSchema,
  type DressRecommendation,
  type RecommendationSignals,
  type UserPreferenceProfile,
  type WeatherSnapshot,
} from './domain.js';

function adjustForPreferences(snapshot: WeatherSnapshot, preferences?: Partial<UserPreferenceProfile>) {
  let perceivedTemperature = snapshot.apparentTemperatureC;

  if (preferences?.coldSensitivity === 'high') {
    perceivedTemperature -= 2;
  }
  if (preferences?.coldSensitivity === 'low') {
    perceivedTemperature += 1;
  }
  if (preferences?.commuteMode === 'bike') {
    perceivedTemperature -= 1;
  }

  return perceivedTemperature;
}

export function deriveRecommendationSignals(
  snapshot: WeatherSnapshot,
  preferences?: Partial<UserPreferenceProfile>,
): RecommendationSignals {
  const perceivedTemperature = adjustForPreferences(snapshot, preferences);

  const thermalLevel =
    perceivedTemperature < 8 ? 'cold' :
    perceivedTemperature < 14 ? 'cool' :
    perceivedTemperature < 21 ? 'mild' :
    perceivedTemperature < 27 ? 'warm' : 'hot';

  const rainLevel =
    snapshot.precipitationProbability >= 55 ? 'likely' :
    snapshot.precipitationProbability >= 25 ? 'possible' : 'dry';

  const windLevel =
    snapshot.windSpeedKph >= 28 ? 'windy' :
    snapshot.windSpeedKph >= 16 ? 'breezy' : 'calm';

  const umbrellaAdvice =
    rainLevel === 'likely' ? 'yes' :
    rainLevel === 'possible' ? 'optional' : 'no';

  const layeringAdvice =
    thermalLevel === 'cold' ? 'heavy' :
    thermalLevel === 'cool' ? 'medium' :
    thermalLevel === 'mild' ? 'medium' : 'light';

  const notes = [
    `${snapshot.locationName} between ${snapshot.forecastWindow.start} and ${snapshot.forecastWindow.end}`,
    `Feels like ${snapshot.apparentTemperatureC}C`,
  ];

  if (preferences?.commuteMode === 'bike') {
    notes.push('Cycling increases wind exposure');
  }
  if (preferences?.hatesUmbrellas && umbrellaAdvice !== 'no') {
    notes.push('User prefers avoiding umbrellas');
  }

  return recommendationSignalsSchema.parse({
    thermalLevel,
    rainLevel,
    windLevel,
    umbrellaAdvice,
    layeringAdvice,
    notes,
  });
}

export function createDeterministicRecommendation(
  snapshot: WeatherSnapshot,
  preferences?: Partial<UserPreferenceProfile>,
): DressRecommendation {
  const signals = deriveRecommendationSignals(snapshot, preferences);
  const accessories: string[] = [];
  const upperBody: string[] = [];
  const lowerBody: string[] = ['long trousers'];
  const footwear: string[] = ['closed shoes'];

  if (signals.layeringAdvice === 'heavy') {
    upperBody.push('long-sleeve base layer', 'warm coat');
  } else if (signals.layeringAdvice === 'medium') {
    upperBody.push('t-shirt', 'light jacket');
  } else {
    upperBody.push('t-shirt');
  }

  if (signals.umbrellaAdvice === 'yes' && !preferences?.hatesUmbrellas) {
    accessories.push('umbrella');
  }
  if (signals.umbrellaAdvice !== 'no' && preferences?.hatesUmbrellas) {
    accessories.push('water-resistant shell');
  }
  if (signals.windLevel === 'windy') {
    accessories.push('windproof outer layer');
  }
  if (signals.thermalLevel === 'hot') {
    lowerBody.splice(0, lowerBody.length, 'breathable trousers or shorts');
    footwear.splice(0, footwear.length, 'lightweight shoes');
  }

  return dressRecommendationSchema.parse({
    weatherSummary: `${snapshot.locationName}: ${snapshot.temperatureC}C, feels like ${snapshot.apparentTemperatureC}C, rain ${snapshot.precipitationProbability}%, wind ${snapshot.windSpeedKph} km/h.`,
    signals,
    clothing: {
      upperBody,
      lowerBody,
      footwear,
      accessories,
    },
    explanation: `Thermal level is ${signals.thermalLevel}, rain is ${signals.rainLevel}, and wind is ${signals.windLevel}.`,
  });
}
