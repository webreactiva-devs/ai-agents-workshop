export function getPreferredLanguageTag(acceptLanguageHeader: unknown): string | undefined {
  if (typeof acceptLanguageHeader !== 'string') {
    return undefined;
  }

  const [firstPreference] = acceptLanguageHeader.split(',');
  const [languageTag] = firstPreference.trim().split(';');

  return languageTag || undefined;
}
