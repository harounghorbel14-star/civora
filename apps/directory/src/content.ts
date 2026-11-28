import { createHash } from 'node:crypto';
import { b64u, CredentialError, verifyJws } from '@civora/credentials';
import type { JWK } from 'jose';

/**
 * The directory's content, as the public pages render it. Everything a page states comes from the **signed canonical
 * content** of a published version (catalogue.canonical_content, doc phase-5/01 §4), after its signature has been
 * checked with the cell's published content key. Only the sources' and offices' details, which the signed content
 * cites by id and code, come from their own public endpoints; a cited source or office that is missing stops the run.
 */
export type Lang = 'ar' | 'fr' | 'en';
export const LANGS: readonly Lang[] = ['ar', 'fr', 'en'];
export const LOCALES: Record<Lang, string> = { ar: 'ar-TN', fr: 'fr-TN', en: 'en' };
/** The Tunisian country pack's default language (same as the citizen web app). */
export const DEFAULT_LANG: Lang = 'ar';

export interface Text { ar: string; fr: string; en?: string }
export type Kind = 'step' | 'document' | 'condition' | 'fee';
export const KINDS: readonly Kind[] = ['step', 'document', 'condition', 'fee'];

export interface Part { kind: Kind; position: number; text: Text; amount_tnd: number | null; sources: string[] }

/** The signed canonical content of a version: catalogue.canonical_content, parsed. */
export interface SignedContent {
  code: string;
  slug: string;
  category: string;
  version: number;
  title: Text;
  summary: Text;
  institution: Text;
  online_url: string | null;
  processing_time: Text | null;
  last_verified_on: string;
  change_note: string;
  requirements: Part[];
  offices: string[];
}

export interface Source {
  id: string;
  kind: 'official-page' | 'legal-text';
  title: string;
  publisher: string;
  url: string;
  jort_reference: string | null;
  language: string;
  accessed_on: string;
}

export interface Office {
  code: string;
  name: Text;
  institution: Text;
  governorate: string;
  address: Text;
  latitude: string | number | null;
  longitude: string | number | null;
  hours: unknown;
  last_verified_on: string;
  source?: Source | null;
}

/** A version as the site shows it: its signed content and what the reader needs to check it. */
export interface Version {
  content: SignedContent;
  state: 'published' | 'superseded';
  publishedAt: string;
  /** SHA-256 of the signed bytes, base64url (the page's integrity.content_digest). */
  digest: string;
  kid: string;
  sources: Source[];
  translationReview: 'pending' | 'reviewed';
}

export interface Service {
  current: Version;
  /** Every published or superseded version, newest first (change history, P5-F3); includes the current one. */
  versions: Version[];
}

export interface Snapshot {
  services: Service[];
  offices: Office[];
}

export class ContentError extends Error {}

const CONTENT_TYP = 'civora-catalogue-content+jws';

/** Checks a detached JWS (`header..signature`) over the exact signed bytes; returns the key id it was made with. */
export async function verifySigned(canonical: string, signature: string, keys: JWK[]): Promise<string> {
  const [h, empty, s] = signature.split('.');
  if (empty !== '' || !h || !s) throw new ContentError('the signature is not a detached JWS');
  let kid: unknown;
  try { kid = JSON.parse(Buffer.from(h, 'base64url').toString('utf8')).kid; } catch { throw new ContentError('the signature header is not JSON'); }
  const key = keys.find((k) => k.kid === kid);
  if (typeof kid !== 'string' || !key) throw new ContentError(`no published content key with kid ${String(kid)}`);
  try {
    await verifyJws(`${h}.${b64u(canonical)}.${s}`, key, CONTENT_TYP);
  } catch (e) {
    if (e instanceof CredentialError) throw new ContentError('the signature does not verify with the published content key');
    throw e;
  }
  return kid;
}

/** The catalogue schema's patterns (migrations-public/1765238400000_catalogue.sql). */
const CODE = /^TN-[A-Z]{3}-[0-9]{3}$/;
const SLUG = /^[a-z0-9][a-z0-9-]{2,80}$/;
const CATEGORY = /^[a-z][a-z-]{2,40}$/;
const OFFICE = /^[a-z0-9][a-z0-9-]{2,62}$/;

const isText = (v: unknown): v is Text =>
  !!v && typeof v === 'object' && typeof (v as Text).ar === 'string' && typeof (v as Text).fr === 'string'
  && ((v as Text).en === undefined || typeof (v as Text).en === 'string');

/** Parses the signed bytes, refusing anything a page could not render faithfully. */
export function parseContent(canonical: string): SignedContent {
  let c: Record<string, unknown>;
  try { c = JSON.parse(canonical); } catch { throw new ContentError('the signed content is not JSON'); }
  const str = (k: string) => { if (typeof c[k] !== 'string') throw new ContentError(`signed content: ${k} missing`); return c[k] as string; };
  for (const k of ['title', 'summary', 'institution']) if (!isText(c[k])) throw new ContentError(`signed content: ${k} needs ar and fr`);
  if (c.processing_time !== null && c.processing_time !== undefined && !isText(c.processing_time)) throw new ContentError('signed content: processing_time needs ar and fr');
  const online = c.online_url ?? null;
  if (online !== null && (typeof online !== 'string' || !online.startsWith('https://'))) throw new ContentError('signed content: online_url must be https');
  if (!Number.isInteger(c.version)) throw new ContentError('signed content: version');
  if (!Array.isArray(c.requirements) || !Array.isArray(c.offices)) throw new ContentError('signed content: requirements and offices');
  const requirements = (c.requirements as Record<string, unknown>[]).map((r) => {
    if (!KINDS.includes(r.kind as Kind) || !Number.isInteger(r.position) || !isText(r.text)) throw new ContentError('signed content: a requirement is malformed');
    const sources = Array.isArray(r.sources) ? (r.sources as unknown[]).filter((x): x is string => typeof x === 'string') : [];
    if (!sources.length) throw new ContentError('signed content: a requirement cites no source');
    const amount = r.amount_tnd === null || r.amount_tnd === undefined ? null : Number(r.amount_tnd);
    if (amount !== null && !Number.isFinite(amount)) throw new ContentError('signed content: amount_tnd');
    return { kind: r.kind as Kind, position: r.position as number, text: r.text as Text, amount_tnd: amount, sources };
  });
  // These become file paths and fragment ids: they must match the database's own patterns (catalogue migration),
  // whatever the core answers.
  if (!CODE.test(str('code')) || !SLUG.test(str('slug')) || !CATEGORY.test(str('category'))) throw new ContentError('signed content: code, slug or category malformed');
  if ((c.version as number) < 1) throw new ContentError('signed content: version');
  const offices = (c.offices as unknown[]).filter((x): x is string => typeof x === 'string');
  if (offices.length !== (c.offices as unknown[]).length || !offices.every((o) => OFFICE.test(o))) throw new ContentError('signed content: an office code is malformed');
  return {
    code: str('code'), slug: str('slug'), category: str('category'), version: c.version as number,
    title: c.title as Text, summary: c.summary as Text, institution: c.institution as Text,
    online_url: online as string | null, processing_time: (c.processing_time ?? null) as Text | null,
    last_verified_on: str('last_verified_on'), change_note: str('change_note'), requirements,
    offices,
  };
}

export type Fetcher = (path: string) => Promise<unknown>;

/** Removes trailing slashes in linear time (a `/\/+$/` replace backtracks on long runs of slashes). */
export function trimTrailingSlashes(s: string): string {
  let end = s.length;
  while (end > 0 && s.charCodeAt(end - 1) === 47) end--;
  return s.slice(0, end);
}

/** A fetcher over the core's public API: JSON, a 200 answer, nothing else. */
export function coreFetcher(coreUrl: string, fetchFn: typeof fetch = fetch): Fetcher {
  const base = trimTrailingSlashes(coreUrl);
  return async (path: string) => {
    const r = await fetchFn(base + path, { headers: { accept: 'application/json' } });
    if (r.status !== 200) throw new ContentError(`GET ${path}: ${r.status}`);
    return r.json();
  };
}

const enc = encodeURIComponent;

/**
 * Reads the published directory from the core and checks it. Throws ContentError (naming the service) when any
 * version's signature does not verify, its signed content cannot be rendered, or a cited source or office is missing:
 * the run then writes nothing, and the site already online stays as it was.
 */
export async function loadSnapshot(get: Fetcher): Promise<Snapshot> {
  const list = await get('/v1/services') as { code: string }[];
  const keys = ((await get('/v1/catalogue/keys')) as { keys?: JWK[] }).keys ?? [];
  const offices = await get('/v1/offices') as Office[];
  if (!Array.isArray(offices) || offices.some((o) => typeof o?.code !== 'string' || !OFFICE.test(o.code))) throw new ContentError('an office code is malformed');
  const officeCodes = new Set(offices.map((o) => o.code));
  if (list.length && !keys.length) throw new ContentError('services are published but the cell publishes no content key');
  const services: Service[] = [];
  for (const { code } of list) {
    try {
      const history = await get(`/v1/services/${enc(code)}/versions`) as { version: number; state: string }[];
      const versions: Version[] = [];
      for (const h of [...history].sort((a, b) => b.version - a.version)) {
        if (h.state !== 'published' && h.state !== 'superseded') continue;
        const signed = await get(`/v1/services/${enc(code)}/versions/${h.version}/content`) as { content: string; signature: string };
        const kid = await verifySigned(signed.content, signed.signature, keys);
        const content = parseContent(signed.content);
        if (content.code !== code || content.version !== h.version) throw new ContentError('the signed content is for another service or version');
        const page = await get(`/v1/services/${enc(code)}/versions/${h.version}`) as { sources?: Source[]; published_at?: string; translation_review?: string };
        const sources = page.sources ?? [];
        const ids = new Set(sources.map((s) => s.id));
        const missing = [...new Set(content.requirements.flatMap((r) => r.sources))].filter((id) => !ids.has(id));
        if (missing.length) throw new ContentError(`cited sources missing: ${missing.join(', ')}`);
        const unknownOffice = content.offices.filter((o) => !officeCodes.has(o));
        if (unknownOffice.length) throw new ContentError(`offices missing: ${unknownOffice.join(', ')}`);
        if (sources.some((s) => !s.url.startsWith('https://'))) throw new ContentError('a source is not https');
        versions.push({
          content, state: h.state, publishedAt: page.published_at ?? '', kid, sources,
          digest: createHash('sha256').update(signed.content, 'utf8').digest('base64url'),
          translationReview: page.translation_review === 'reviewed' ? 'reviewed' : 'pending',
        });
      }
      const current = versions.find((v) => v.state === 'published');
      if (!current) throw new ContentError('no published version');
      services.push({ current, versions });
    } catch (e) {
      if (e instanceof ContentError) throw new ContentError(`${code}: ${e.message}`);
      throw e;
    }
  }
  services.sort((a, b) => a.current.content.code.localeCompare(b.current.content.code));
  return { services, offices };
}
