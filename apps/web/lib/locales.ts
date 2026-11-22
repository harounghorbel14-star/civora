import { directionOf, negotiateLocale } from '@civora/i18n';

/** URL language segment -> locale of the country pack (the core stores the pack locale). */
export const LOCALES = { ar: 'ar-TN', fr: 'fr-TN', en: 'en' } as const;
export type Lang = keyof typeof LOCALES;
export const LANGS = Object.keys(LOCALES) as Lang[];
export const DEFAULT_LANG: Lang = 'ar'; // Tunisian pack default

export const isLang = (v: unknown): v is Lang => typeof v === 'string' && (LANGS as string[]).includes(v);

export function langOf(packLocale: string | null | undefined): Lang | null {
  const l = (packLocale ?? '').split('-')[0]!.toLowerCase();
  return isLang(l) ? l : null;
}

/** The language for a visitor without a choice yet: Accept-Language against the cell's locales. */
export function negotiateLang(acceptLanguage: string | null | undefined): Lang {
  return langOf(negotiateLocale(acceptLanguage, Object.values(LOCALES), LOCALES[DEFAULT_LANG])) ?? DEFAULT_LANG;
}

export const dirOf = (lang: Lang): 'rtl' | 'ltr' => directionOf(lang);
