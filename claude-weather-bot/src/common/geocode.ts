const KNOWN_LOCATIONS: Record<string, { latitude: number; longitude: number; locationName: string }> = {
  madrid: { latitude: 40.4168, longitude: -3.7038, locationName: 'Madrid' },
  barcelona: { latitude: 41.3874, longitude: 2.1686, locationName: 'Barcelona' },
  valencia: { latitude: 39.4699, longitude: -0.3763, locationName: 'Valencia' },
  bilbao: { latitude: 43.263, longitude: -2.935, locationName: 'Bilbao' },
  sevilla: { latitude: 37.3891, longitude: -5.9845, locationName: 'Sevilla' },
  london: { latitude: 51.5074, longitude: -0.1278, locationName: 'London' },
  paris: { latitude: 48.8566, longitude: 2.3522, locationName: 'Paris' },
  berlin: { latitude: 52.52, longitude: 13.405, locationName: 'Berlin' },
  'new york': { latitude: 40.7128, longitude: -74.006, locationName: 'New York' },
  tokyo: { latitude: 35.6762, longitude: 139.6503, locationName: 'Tokyo' },
};

export function resolveLocation(locationName?: string): { latitude: number; longitude: number; locationName: string } {
  if (!locationName) {
    return KNOWN_LOCATIONS.madrid;
  }

  return KNOWN_LOCATIONS[locationName.trim().toLowerCase()] ?? {
    latitude: 40.4168,
    longitude: -3.7038,
    locationName,
  };
}
