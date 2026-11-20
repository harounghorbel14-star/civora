/**
 * @civora/i18n — shared internationalisation primitives (Phase 2, O-F3).
 *
 * Rules (ADR-022, ADR-014):
 * - Direction is derived from the language subtag, never hard-coded per screen.
 * - Locale negotiation follows RFC 9110 Accept-Language with quality values.
 * - Western Arabic digits ("latn") are the default numbering system for Tunisia
 *   (Phase 1 doc 16 §16.5); country packs may override.
 */

export type Direction = 'ltr' | 'rtl';

export interface LocaleInfo {
  code: string;
  language: string;
  region: string | null;
  dir: Direction;
  nameEn: string;
  nativeName: string;
  numberingSystem: string;
}

const RTL_LANGUAGES = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'dv', 'yi', 'ckb', 'sd', 'ug']);

export function languageOf(locale: string): string {
  return (locale.split(/[-_]/)[0] ?? '').toLowerCase();
}

export function directionOf(locale: string): Direction {
  return RTL_LANGUAGES.has(languageOf(locale)) ? 'rtl' : 'ltr';
}

export function htmlAttributes(locale: string): { lang: string; dir: Direction } {
  return { lang: locale, dir: directionOf(locale) };
}

export interface WeightedTag {
  tag: string;
  q: number;
}

/** Parse an Accept-Language header (RFC 9110 §12.5.4). Invalid entries are ignored. */
export function parseAcceptLanguage(header: string | undefined | null): WeightedTag[] {
  if (!header) return [];
  const out: WeightedTag[] = [];
  for (const part of header.split(',')) {
    const [rawTag, ...params] = part.trim().split(';');
    const tag = (rawTag ?? '').trim();
    if (!tag || !/^([a-zA-Z]{1,8})(-[a-zA-Z0-9]{1,8})*$|^\*$/.test(tag)) continue;
    let q = 1;
    for (const p of params) {
      const m = /^\s*q=([01](?:\.\d{0,3})?)\s*$/.exec(p);
      if (m && m[1] !== undefined) q = Number(m[1]);
    }
    if (q > 0) out.push({ tag, q });
  }
  return out.sort((a, b) => b.q - a.q);
}

/**
 * Pick the best supported locale: exact match first, then same language, then fallback.
 * Comparison is case-insensitive; the supported spelling is returned.
 */
export function negotiateLocale(header: string | undefined | null, supported: readonly string[], fallback: string): string {
  const lower = supported.map((s) => s.toLowerCase());
  for (const { tag } of parseAcceptLanguage(header)) {
    if (tag === '*') return fallback;
    const exact = lower.indexOf(tag.toLowerCase());
    if (exact >= 0) return supported[exact] as string;
    const lang = languageOf(tag);
    const byLang = lower.findIndex((s) => languageOf(s) === lang);
    if (byLang >= 0) return supported[byLang] as string;
  }
  return fallback;
}

export function describeLocale(code: string, numberingSystem = 'latn'): LocaleInfo {
  const parts = code.split(/[-_]/);
  const language = languageOf(code);
  const region = parts.length > 1 && parts[1] ? parts[1].toUpperCase() : null;
  const en = new Intl.DisplayNames(['en'], { type: 'language' });
  let native: string;
  try {
    native = new Intl.DisplayNames([code], { type: 'language' }).of(language) ?? code;
  } catch {
    native = code;
  }
  return {
    code,
    language,
    region,
    dir: directionOf(code),
    nameEn: en.of(language) ?? code,
    nativeName: native,
    numberingSystem,
  };
}

export function formatNumber(value: number, locale: string, options: Intl.NumberFormatOptions = {}, numberingSystem = 'latn'): string {
  return new Intl.NumberFormat(`${locale}-u-nu-${numberingSystem}`, options).format(value);
}

export function formatDate(date: Date, locale: string, options: Intl.DateTimeFormatOptions = { dateStyle: 'short' }, numberingSystem = 'latn', timeZone = 'Africa/Tunis'): string {
  return new Intl.DateTimeFormat(`${locale}-u-nu-${numberingSystem}`, { ...options, timeZone }).format(date);
}

/** Message catalogue: plain strings or plural forms keyed by Intl.PluralRules categories. */
export type Message = string | Partial<Record<Intl.LDMLPluralRule, string>>;
export type Catalogue = Record<string, Message>;

export interface Translator {
  locale: string;
  dir: Direction;
  t(key: string, vars?: Record<string, string | number>): string;
}

export function createTranslator(catalogues: Record<string, Catalogue>, locale: string, fallback: string): Translator {
  const primary = catalogues[locale] ?? {};
  const secondary = catalogues[fallback] ?? {};
  const plural = new Intl.PluralRules(locale);
  return {
    locale,
    dir: directionOf(locale),
    t(key, vars = {}) {
      const msg = primary[key] ?? secondary[key];
      if (msg === undefined) return key; // visible, testable fallback; never throws in UI
      let text: string;
      if (typeof msg === 'string') text = msg;
      else {
        const count = typeof vars.count === 'number' ? vars.count : 0;
        text = msg[plural.select(count)] ?? msg.other ?? key;
      }
      return text.replace(/\{(\w+)\}/g, (_, name: string) => {
        const v = vars[name];
        return v === undefined ? `{${name}}` : typeof v === 'number' ? formatNumber(v, locale) : v;
      });
    },
  };
}
