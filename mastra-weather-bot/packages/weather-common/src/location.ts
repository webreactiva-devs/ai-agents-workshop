const KNOWN_LOCATIONS: Record<string, { latitude: number; longitude: number; locationName: string }> = {
  madrid: { latitude: 40.4168, longitude: -3.7038, locationName: 'Madrid' },
  barcelona: { latitude: 41.3874, longitude: 2.1686, locationName: 'Barcelona' },
  valencia: { latitude: 39.4699, longitude: -0.3763, locationName: 'Valencia' },
  bilbao: { latitude: 43.263, longitude: -2.935, locationName: 'Bilbao' },
};

export function resolveLocation(locationName?: string) {
  if (!locationName) {
    return KNOWN_LOCATIONS.madrid;
  }

  return KNOWN_LOCATIONS[locationName.trim().toLowerCase()] ?? {
    latitude: 40.4168,
    longitude: -3.7038,
    locationName,
  };
}
