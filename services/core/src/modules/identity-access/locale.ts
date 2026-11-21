/**
 * Locales: Keycloak speaks language codes (ar, fr, en); the country pack speaks the cell's locales (ar-TN, fr-TN,
 * en). A token's locale is mapped onto the pack before it is stored, so a preference is always one the API accepts.
 */
export function packLocale(locale: string | null | undefined, supported: readonly string[], fallback: string): string {
  if (!locale) return fallback;
  if (supported.includes(locale)) return locale;
  const language = locale.split('-')[0]!.toLowerCase();
  return supported.find((s) => s.split('-')[0]!.toLowerCase() === language) ?? fallback;
}

/** The language code Keycloak uses for a pack locale (pages and e-mails). */
export function keycloakLocale(locale: string): string {
  return locale.split('-')[0]!.toLowerCase();
}
