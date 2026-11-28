import type { Pool } from 'pg';

/**
 * The catalogue's database access (Phase 5; doc phase-5/01), on the pg-public cluster (CATALOGUE_DATABASE_URL), as the
 * application role: published content through views, every change through the schema's functions.
 */
export interface Localised { ar: string; fr: string; en?: string }

export interface PublishedService {
  code: string;
  slug: string;
  category: string;
  version: number;
  state: 'published' | 'superseded';
  title: Localised;
  summary: Localised;
  institution: Localised;
  onlineUrl: string | null;
  processingTime: Localised | null;
  lastVerifiedOn: string;
  changeNote: string;
  publishedAt: Date;
  contentDigest: string;
  signature: string;
  translationReview: 'pending' | 'reviewed';
}

export class CatalogueError extends Error {
  constructor(readonly kind: 'not-found' | 'conflict' | 'invalid' | 'forbidden' | 'too-many', message: string) {
    super(message);
  }
}

const published = (r: Record<string, any>): PublishedService => ({
  code: r.code, slug: r.slug, category: r.category, version: r.version, state: r.state, title: r.title, summary: r.summary, institution: r.institution,
  onlineUrl: r.online_url, processingTime: r.processing_time, lastVerifiedOn: r.last_verified_on instanceof Date ? r.last_verified_on.toISOString().slice(0, 10) : String(r.last_verified_on),
  changeNote: r.change_note, publishedAt: r.published_at, contentDigest: (r.content_digest as Buffer).toString('base64url'), signature: r.signature,
  translationReview: r.translation_review,
});

/** Maps the schema's error codes to what the API answers. */
function mapped(e: unknown): never {
  const code = (e as { code?: string }).code;
  const msg = (e as Error).message;
  if (code === '42501') throw new CatalogueError('forbidden', msg);
  if (code === '42704') throw new CatalogueError('not-found', msg);
  if (code === '55000' || code === '23505') throw new CatalogueError('conflict', msg);
  if (code === '22023' || code === '23514' || code === '22P02' || code === '23503' || code === '22007' || code === '22008') throw new CatalogueError('invalid', msg);
  if (code === '54000') throw new CatalogueError('too-many', msg);
  throw e;
}

export class CatalogueRepository {
  constructor(private readonly pool: Pool) {}

  private async q<T = Record<string, any>>(sql: string, params: unknown[] = []): Promise<T[]> {
    try {
      return (await this.pool.query(sql, params)).rows as T[];
    } catch (e) {
      return mapped(e);
    }
  }

  /** P5-API1: the published services (current versions), optionally by category. */
  async list(category?: string): Promise<PublishedService[]> {
    const rows = await this.q("select * from catalogue.published_version where state = 'published' and ($1::text is null or category = $1) order by code", [category ?? null]);
    return rows.map(published);
  }

  async byCode(code: string, version?: number): Promise<PublishedService | null> {
    const rows = version === undefined
      ? await this.q("select * from catalogue.published_version where (code = $1 or slug = $1) and state = 'published'", [code])
      : await this.q('select * from catalogue.published_version where (code = $1 or slug = $1) and version = $2', [code, version]);
    return rows[0] ? published(rows[0]) : null;
  }

  async versions(code: string): Promise<{ version: number; state: string; publishedAt: Date; changeNote: string; lastVerifiedOn: string }[]> {
    return (await this.q('select version, state, published_at, change_note, last_verified_on from catalogue.published_version where code = $1 or slug = $1 order by version desc', [code]))
      .map((r) => ({ version: r.version, state: r.state, publishedAt: r.published_at, changeNote: r.change_note, lastVerifiedOn: String(r.last_verified_on instanceof Date ? r.last_verified_on.toISOString().slice(0, 10) : r.last_verified_on) }));
  }

  async requirements(serviceCode: string, version: number): Promise<{ kind: string; position: number; text: Localised; amountTnd: number | null; sources: string[] }[]> {
    return (await this.q(`select r.kind, r.position, r.text, r.amount_tnd, r.source_ids from catalogue.published_requirement r
      join catalogue.published_version v on v.service_id = r.service_id and v.version = r.version where v.code = $1 and v.version = $2 order by r.kind, r.position`, [serviceCode, version]))
      .map((r) => ({ kind: r.kind, position: r.position, text: r.text, amountTnd: r.amount_tnd === null ? null : Number(r.amount_tnd), sources: r.source_ids }));
  }

  async sources(ids: string[]): Promise<{ id: string; kind: string; title: string; publisher: string; url: string; jortReference: string | null; language: string; accessedOn: string }[]> {
    if (!ids.length) return [];
    return (await this.q('select * from catalogue.source_ref where id = any($1::uuid[]) order by title', [ids]))
      .map((r) => ({ id: r.id, kind: r.kind, title: r.title, publisher: r.publisher, url: r.url, jortReference: r.jort_reference, language: r.language, accessedOn: String(r.accessed_on instanceof Date ? r.accessed_on.toISOString().slice(0, 10) : r.accessed_on) }));
  }

  /** P5-API2 / P5-F2: offices, optionally by governorate. */
  async offices(governorate?: string): Promise<Record<string, unknown>[]> {
    // Each office with the official source it is listed from (P5-F2: every fact cited); its id is what drafts cite.
    return this.q(`select o.id, o.code, o.name, o.institution, o.governorate, o.address, o.latitude, o.longitude, o.hours, o.last_verified_on,
        jsonb_build_object('id', s.id, 'kind', s.kind, 'title', s.title, 'publisher', s.publisher, 'url', s.url, 'jort_reference', s.jort_reference,
                           'language', s.language, 'accessed_on', s.accessed_on) as source
      from catalogue.office o join catalogue.source_ref s on s.id = o.source_ref_id
      where ($1::text is null or o.governorate = $1) order by o.governorate, o.code`, [governorate ?? null]);
  }

  async search(query: string, limit = 20): Promise<{ code: string; slug: string; rank: number }[]> {
    return this.q('select code, slug, rank from catalogue.search($1, $2)', [query, limit]);
  }

  // Editorial (P5-API3). The caller has checked the role (RBAC) and passes the person id from the staff token.
  async createService(code: string, slug: string, category: string, actor: string, draft: unknown): Promise<string> {
    return (await this.q<{ id: string }>('select catalogue.create_service($1, $2, $3, $4, $5) as id', [code, slug, category, actor, draft]))[0]!.id;
  }

  async putDraft(serviceId: string, version: number, actor: string, draft: unknown): Promise<number> {
    return (await this.q<{ v: number }>('select catalogue.put_draft($1, $2, $3, $4) as v', [serviceId, version, actor, draft]))[0]!.v;
  }

  async submit(serviceId: string, version: number, actor: string): Promise<void> {
    await this.q('select catalogue.submit($1, $2, $3)', [serviceId, version, actor]);
  }

  async canonical(serviceId: string, version: number): Promise<string | null> {
    return (await this.q<{ c: string | null }>('select catalogue.canonical_content($1, $2)::text as c', [serviceId, version]))[0]?.c ?? null;
  }

  async approve(serviceId: string, version: number, actor: string, digest: Buffer, signature: string): Promise<void> {
    await this.q('select catalogue.approve($1, $2, $3, $4, $5)', [serviceId, version, actor, digest, signature]);
  }

  async requestChanges(serviceId: string, version: number, actor: string, comment: string): Promise<void> {
    await this.q('select catalogue.request_changes($1, $2, $3, $4)', [serviceId, version, actor, comment]);
  }

  async publish(serviceId: string, version: number, actor: string): Promise<void> {
    await this.q('select catalogue.publish($1, $2, $3)', [serviceId, version, actor]);
  }

  async reportError(code: string, version: number, message: string): Promise<string> {
    return (await this.q<{ id: string }>('select catalogue.report_error($1, $2, $3) as id', [code, version, message]))[0]!.id;
  }

  /** The exact signed content of a published (or superseded) version, for anyone checking its signature. */
  async publishedCanonical(code: string, version: number): Promise<{ canonical: string; signature: string } | null> {
    const r = await this.q<{ service_id: string; signature: string }>('select service_id, signature from catalogue.published_version where (code = $1 or slug = $1) and version = $2', [code, version]);
    if (!r[0]) return null;
    const c = await this.canonical(r[0].service_id, version);
    return c ? { canonical: c, signature: r[0].signature } : null;
  }

  async addSource(s: { kind: string; title: string; publisher: string; url: string; jortReference: string | null; language: string; accessedOn: string }): Promise<string> {
    return (await this.q<{ id: string }>('select catalogue.add_source($1, $2, $3, $4, $5, $6, $7) as id', [s.kind, s.title, s.publisher, s.url, s.jortReference, s.language, s.accessedOn]))[0]!.id;
  }

  /** An office as an official page lists it (P5-F2, P5-DB5); the database checks the source and the coordinates. */
  async addOffice(o: { code: string; name: unknown; institution: unknown; governorate: string; address: unknown; latitude: number | null; longitude: number | null;
    hours: unknown; sourceId: string; lastVerifiedOn: string }): Promise<string> {
    return (await this.q<{ id: string }>('select catalogue.add_office($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) as id',
      [o.code, o.name, o.institution, o.governorate, o.address, o.latitude, o.longitude, o.hours ?? null, o.sourceId, o.lastVerifiedOn]))[0]!.id;
  }

  /** Readers' error reports, newest first (P5-F4): the code and version they are about, the message, the decision. */
  async errorReports(status: 'open' | 'accepted' | 'rejected', limit: number): Promise<Record<string, unknown>[]> {
    return this.q('select id, code, slug, version, message, status, created_at, handled_at, note from catalogue.list_error_reports($1, $2)', [status, limit]);
  }

  async decideErrorReport(id: string, actor: string, decision: 'accepted' | 'rejected', note: string | null): Promise<void> {
    await this.q('select catalogue.decide_error_report($1, $2, $3, $4)', [id, actor, decision, note]);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
