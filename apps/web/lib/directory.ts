/**
 * The two parts of the services directory that need a server (Phase 5, doc phase-5/03): search (P5-D4) and
 * "report an error" (P5-F4). The pages themselves are static (apps/directory); these helpers check what the browser
 * sends and what the core answers before anything is shown or forwarded.
 */

/** The catalogue schema's patterns (services/core/migrations-public). */
const CODE = /^TN-[A-Z]{3}-[0-9]{3}$/;
const SLUG = /^[a-z0-9][a-z0-9-]{2,80}$/;

export interface Text { ar: string; fr: string; en?: string }
export interface SearchHit { code: string; slug: string; title: Text; summary: Text; lastVerifiedOn: string }

/** A search query: one value (a repeated key is refused), 2 to 200 characters once trimmed. */
export function searchQuery(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const q = raw.trim();
  return q.length >= 2 && q.length <= 200 ? q : null;
}

const isText = (v: unknown): v is Text =>
  !!v && typeof v === 'object' && typeof (v as Text).ar === 'string' && typeof (v as Text).fr === 'string'
  && ((v as Text).en === undefined || typeof (v as Text).en === 'string');

/** The core's search answer, keeping only well-formed entries (a slug becomes a link). */
export function searchHits(body: unknown): SearchHit[] {
  if (!Array.isArray(body)) return [];
  return body.flatMap((h: Record<string, unknown>) => {
    if (!h || typeof h.code !== 'string' || !CODE.test(h.code) || typeof h.slug !== 'string' || !SLUG.test(h.slug)) return [];
    if (!isText(h.title) || !isText(h.summary) || typeof h.last_verified_on !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(h.last_verified_on)) return [];
    return [{ code: h.code, slug: h.slug, title: h.title, summary: h.summary, lastVerifiedOn: h.last_verified_on }];
  });
}

/** The text in the page's language; English falls back to French (and says which language it is). */
export function textIn(t: Text, lang: 'ar' | 'fr' | 'en'): { text: string; lang: 'ar' | 'fr' | 'en' } {
  if (lang === 'en' && !t.en) return { text: t.fr, lang: 'fr' };
  return { text: (lang === 'en' ? t.en : t[lang]) as string, lang };
}

/** The version a report is about: a service code and a version number, as the static page links them. */
export function reportTarget(code: unknown, version: unknown): { code: string; version: number } | null {
  if (typeof code !== 'string' || !CODE.test(code) || typeof version !== 'string' || !/^[0-9]{1,4}$/.test(version)) return null;
  const v = Number(version);
  return v >= 1 ? { code, version: v } : null;
}

/** The report itself: 5 to 2000 characters, nothing else is asked for or kept (P5-F4, no personal data). */
export function reportMessage(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const m = raw.trim();
  return m.length >= 5 && m.length <= 2000 ? m : null;
}
