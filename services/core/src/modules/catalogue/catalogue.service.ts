import { createHash } from 'node:crypto';
import { b64u, CredentialError, pkcs11Signer, type Pkcs11Signer, verifyJws } from '@civora/credentials';
import type { JWK } from 'jose';
import { CatalogueError, type CatalogueRepository, type PublishedService } from './catalogue.repository';

/**
 * The Government Services Directory (Phase 5; docs phase-5/00..02): published content for everyone, and the editorial
 * workflow for the cell operator's staff — editors write drafts, an approver who is not the author approves (four-eyes,
 * P5-D2), the approved content is signed (P5-SEC2) and published; every version stays readable (change history, P5-F3).
 *
 * Signatures: a detached JWS (RFC 7515 appendix F) over the canonical content of the version, made in the HSM with the
 * cell's content key (doc 02); anyone can check a page against the public key served at /v1/catalogue/keys
 * (integrity monitoring, P5-SEC3).
 */
export const CONTENT_TYP = 'civora-catalogue-content+jws';
export const ROLES = { editor: 'catalogue-editor', approver: 'catalogue-approver' } as const;

export interface CatalogueConfig {
  /** The cell's content-signing key in the HSM; null = no key in this cell: pages are served, approvals are refused. */
  hsm: { module: string; tokenLabel: string; keyId: string; kid: string; pinEnv: string } | null;
  /** Only staff of this institution (the cell operator) may edit; null only in dev and test (any staff tenant). */
  editorTenant: string | null;
}

/**
 * The editorial settings. The editors' institution is required outside dev and test whether or not a signing key is
 * configured: a cell without its key still takes drafts and sources, and they are for the cell operator's staff only.
 * A signing key named in part (token, key id or kid missing) is a configuration error, not "no key".
 */
export function loadCatalogueConfig(env: NodeJS.ProcessEnv = process.env): CatalogueConfig {
  const editorTenant = (env.CATALOGUE_EDITOR_TENANT ?? '').trim() || null;
  if (!editorTenant && !['dev', 'test'].includes(env.CIVORA_ENV ?? 'dev')) throw new Error('CATALOGUE_EDITOR_TENANT is required outside dev and test');
  const module = (env.CATALOGUE_HSM_MODULE ?? env.WALLET_HSM_MODULE ?? '').trim();
  const tokenLabel = (env.CATALOGUE_SIGNING_TOKEN ?? '').trim();
  const keyId = (env.CATALOGUE_SIGNING_KEY_ID ?? '').trim().toLowerCase();
  const kid = (env.CATALOGUE_SIGNING_KID ?? '').trim();
  const named = [tokenLabel, keyId, kid].filter(Boolean).length;
  if (named === 0) return { hsm: null, editorTenant };
  if (named < 3 || !module) throw new Error('the content-signing key needs CATALOGUE_SIGNING_TOKEN, CATALOGUE_SIGNING_KEY_ID, CATALOGUE_SIGNING_KID and an HSM module');
  if (!/^[0-9a-f]{2,64}$/.test(keyId)) throw new Error('CATALOGUE_SIGNING_KEY_ID is hex');
  return { hsm: { module, tokenLabel, keyId, kid, pinEnv: (env.CATALOGUE_HSM_PIN_ENV ?? 'CIVORA_HSM_PIN').trim() }, editorTenant };
}

export interface Editor {
  personId: string;
  tenantId: string | null;
  roles: string[];
}

export class Catalogue {
  private signer: Promise<Pkcs11Signer> | null = null;

  constructor(private readonly repo: CatalogueRepository, private readonly cfg: CatalogueConfig) {}

  private hsm(): NonNullable<CatalogueConfig['hsm']> {
    if (!this.cfg.hsm) throw new CatalogueError('forbidden', 'content signing is not configured in this cell');
    return this.cfg.hsm;
  }

  private key(): Promise<Pkcs11Signer> {
    const hsm = this.hsm();
    if (!this.signer) {
      this.signer = pkcs11Signer({ ...hsm });
      this.signer.catch(() => { this.signer = null; });
    }
    return this.signer;
  }

  /**
   * The content-signing public keys (JWKS), for anyone checking a page (P5-SEC3). A cell without its key has signed
   * nothing it could approve, and answers with an empty set rather than an error.
   */
  async keys(): Promise<{ keys: JWK[] }> {
    if (!this.cfg.hsm) return { keys: [] };
    const s = await this.key();
    return { keys: [{ ...s.publicJwk, kid: this.hsm().kid, alg: 'ES256', use: 'sig' }] };
  }

  /** A service page (P5-F1): the version, its parts with their sources, and the signature to check it with. */
  async page(code: string, version?: number): Promise<Record<string, unknown> | null> {
    const s = await this.repo.byCode(code, version);
    if (!s) return null;
    const parts = await this.repo.requirements(s.code, s.version);
    const sources = await this.repo.sources([...new Set(parts.flatMap((p) => p.sources))]);
    const group = (kind: string) => parts.filter((p) => p.kind === kind).map((p) => ({ position: p.position, text: p.text, ...(p.amountTnd !== null ? { amount_tnd: p.amountTnd } : {}), sources: p.sources }));
    return {
      code: s.code, slug: s.slug, category: s.category, version: s.version, state: s.state,
      title: s.title, summary: s.summary, institution: s.institution, online_url: s.onlineUrl, processing_time: s.processingTime,
      steps: group('step'), documents: group('document'), conditions: group('condition'), fees: group('fee'),
      sources: sources.map((x) => ({ id: x.id, kind: x.kind, title: x.title, publisher: x.publisher, url: x.url, jort_reference: x.jortReference, language: x.language, accessed_on: x.accessedOn })),
      last_verified_on: s.lastVerifiedOn, published_at: s.publishedAt.toISOString(), change_note: s.changeNote,
      translation_review: s.translationReview,
      integrity: { content_digest: s.contentDigest, signature: s.signature, keys: '/v1/catalogue/keys' },
    };
  }

  list(category?: string): Promise<PublishedService[]> {
    return this.repo.list(category);
  }

  /** P5-D4: search, then the list entries of the matches in rank order. */
  async searchView(q: string): Promise<Record<string, unknown>[]> {
    const hits = await this.repo.search(q, 20);
    const all = new Map((await this.repo.list()).map((s) => [s.code, s]));
    return hits.map((h) => all.get(h.code)).filter((s): s is PublishedService => !!s)
      .map((s) => ({ code: s.code, slug: s.slug, category: s.category, version: s.version, title: s.title, summary: s.summary, institution: s.institution, last_verified_on: s.lastVerifiedOn }));
  }

  /** P5-F3: the change history. */
  async history(code: string): Promise<Record<string, unknown>[]> {
    const v = await this.repo.versions(code);
    if (!v.length) throw new CatalogueError('not-found', 'no such published service');
    return v.map((x) => ({ version: x.version, state: x.state, published_at: x.publishedAt.toISOString(), change_note: x.changeNote, last_verified_on: x.lastVerifiedOn }));
  }

  /** The signed bytes of a version (P5-SEC2, SEC3): check with verifyContent and the key from keys(). */
  async signedContent(code: string, version: number): Promise<{ canonical: string; signature: string } | null> {
    return this.repo.publishedCanonical(code, version);
  }

  /** Editors register the sources they cite (official pages and legal texts). */
  async addSource(e: Editor, src: { kind: string; title: string; publisher: string; url: string; jortReference: string | null; language: string; accessedOn: string }): Promise<string> {
    this.require(e, ROLES.editor);
    return this.repo.addSource(src);
  }

  /** Editors register the offices that procedures send people to, each from an official source (P5-F2). */
  async addOffice(e: Editor, o: Parameters<CatalogueRepository['addOffice']>[0]): Promise<string> {
    this.require(e, ROLES.editor);
    return this.repo.addOffice(o);
  }

  /** The readers' error reports, for the operator's editors (P5-F4). Nothing in them identifies the reader. */
  async errorReports(e: Editor, status: 'open' | 'accepted' | 'rejected', limit = 50): Promise<Record<string, unknown>[]> {
    this.require(e, ROLES.editor);
    return this.repo.errorReports(status, limit);
  }

  /** An editor's decision on an open report: accepted (a new version will correct the page) or rejected; once only. */
  async decideErrorReport(e: Editor, id: string, decision: 'accepted' | 'rejected', note: string | null): Promise<void> {
    this.require(e, ROLES.editor);
    await this.repo.decideErrorReport(id, e.personId, decision, note);
  }

  offices(governorate?: string): Promise<Record<string, unknown>[]> {
    return this.repo.offices(governorate);
  }

  // ------------------------------------------------------------------ editorial (P5-API3, P5-SEC1)

  private require(e: Editor, role: string): void {
    if (!e.roles.includes(role)) throw new CatalogueError('forbidden', `the ${role} role is required`);
    if (this.cfg.editorTenant !== null && e.tenantId !== this.cfg.editorTenant) throw new CatalogueError('forbidden', 'only the cell operator\'s staff edit the catalogue');
  }

  async create(e: Editor, code: string, slug: string, category: string, draft: unknown): Promise<string> {
    this.require(e, ROLES.editor);
    return this.repo.createService(code, slug, category, e.personId, draft);
  }

  async putDraft(e: Editor, serviceId: string, version: number, draft: unknown): Promise<number> {
    this.require(e, ROLES.editor);
    return this.repo.putDraft(serviceId, version, e.personId, draft);
  }

  async submit(e: Editor, serviceId: string, version: number): Promise<void> {
    this.require(e, ROLES.editor);
    await this.repo.submit(serviceId, version, e.personId);
  }

  async requestChanges(e: Editor, serviceId: string, version: number, comment: string): Promise<void> {
    this.require(e, ROLES.approver);
    await this.repo.requestChanges(serviceId, version, e.personId, comment);
  }

  /** Four-eyes approval: the database refuses the author; the canonical content is signed in the HSM first. */
  async approve(e: Editor, serviceId: string, version: number): Promise<{ content_digest: string; signature: string }> {
    this.require(e, ROLES.approver);
    const canonical = await this.repo.canonical(serviceId, version);
    if (!canonical) throw new CatalogueError('not-found', 'no such version');
    const signer = await this.key();
    const header = b64u(JSON.stringify({ alg: 'ES256', kid: this.hsm().kid, typ: CONTENT_TYP }));
    const sig = b64u(await signer.sign(Buffer.from(`${header}.${b64u(canonical)}`, 'ascii')));
    const digest = createHash('sha256').update(canonical, 'utf8').digest();
    const signature = `${header}..${sig}`;
    await this.repo.approve(serviceId, version, e.personId, digest, signature);
    return { content_digest: digest.toString('base64url'), signature };
  }

  async publish(e: Editor, serviceId: string, version: number): Promise<void> {
    this.require(e, ROLES.approver);
    await this.repo.publish(serviceId, version, e.personId);
  }

  async reportError(code: string, version: number, message: string): Promise<string> {
    return this.repo.reportError(code, version, message);
  }

  close(): Promise<void> {
    return this.repo.close();
  }
}

/**
 * Checks a published page against its signature (P5-SEC3): the canonical content is rebuilt by the caller (the
 * integrity monitor reads it from the database) and must verify under the content key.
 */
export async function verifyContent(canonical: string, signature: string, key: JWK): Promise<boolean> {
  const [h, empty, s] = signature.split('.');
  if (empty !== '' || !h || !s) return false;
  try {
    await verifyJws(`${h}.${b64u(canonical)}.${s}`, key, CONTENT_TYP);
    return true;
  } catch (e) {
    if (e instanceof CredentialError) return false;
    throw e;
  }
}
