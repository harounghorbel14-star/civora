import type { JWK } from 'jose';
import type { Pool, PoolClient } from 'pg';

export interface IssuerRow {
  id: string;
  slug: string;
  issuerUrl: string;
  display: Record<'ar' | 'fr' | 'en', string>;
  status: string;
  kid: string;
  publicJwk: JWK;
  hsmTokenLabel: string;
  hsmKeyId: string;
}

export interface CredentialTypeRow {
  id: string;
  issuerId: string;
  vct: string;
  display: Record<'ar' | 'fr' | 'en', string>;
  claims: string[];
  selectivelyDisclosable: string[];
  validityDays: number;
  renewalServiceSlug: string | null;
}

export interface VerifierRow {
  id: string;
  clientId: string;
  display: Record<'ar' | 'fr' | 'en', string>;
  requestJwk: JWK;
  requestKid: string;
  hsmTokenLabel: string;
  hsmKeyId: string;
  allowedVct: string[];
  allowedClaims: string[];
  status: string;
  tenantId: string | null;
}

export interface PendingRequest {
  requestId: string;
  clientId: string;
  nonce: string;
  vct: string;
  claims: string[];
}

export interface OpenRequest {
  clientId: string;
  nonce: string;
  state: string;
  vct: string;
  claims: string[];
  expiresAt: Date;
  requestKid: string;
  hsmTokenLabel: string;
  hsmKeyId: string;
  requestJwk: JWK;
}

export interface TokenGrant {
  dpopJkt: string;
  credentialTypeId: string;
  issuerId: string;
  subjectPersonId: string;
  usable: boolean;
}

export interface NewWalletEntry {
  vct: string;
  issuerUrl: string;
  issuedAt: Date;
  expiresAt: Date;
  statusUri: string | null;
  statusIdx: number | null;
  backupCiphertext: Buffer | null;
  backupKeyId: string | null;
}
export interface WalletEntry extends NewWalletEntry {
  id: string;
  createdAt: Date;
}
const entry = (r: Record<string, unknown>): WalletEntry => ({
  id: r.id as string, vct: r.vct as string, issuerUrl: r.issuer_url as string, issuedAt: r.issued_at as Date, expiresAt: r.expires_at as Date,
  statusUri: (r.status_uri as string | null) ?? null, statusIdx: (r.status_idx as number | null) ?? null,
  backupCiphertext: (r.backup_ciphertext as Buffer | null) ?? null, backupKeyId: (r.backup_key_jkt as string | null) ?? null, createdAt: r.created_at as Date,
});

const issuer = (r: Record<string, unknown>): IssuerRow => ({
  id: r.id as string, slug: r.slug as string, issuerUrl: r.issuer_url as string, display: r.display as IssuerRow['display'], status: r.status as string,
  kid: r.kid as string, publicJwk: r.public_jwk as JWK, hsmTokenLabel: r.hsm_token_label as string, hsmKeyId: r.hsm_key_id as string,
});
const type = (r: Record<string, unknown>): CredentialTypeRow => ({
  id: r.id as string, issuerId: r.issuer_id as string, vct: r.vct as string, display: r.display as CredentialTypeRow['display'], claims: r.claims as string[],
  selectivelyDisclosable: r.selectively_disclosable as string[], validityDays: r.validity_days as number, renewalServiceSlug: (r.renewal_service_slug as string | null) ?? null,
});

/**
 * The wallet module's database access, as the application role (doc phase-4/01, 03). Issuers, types and status lists
 * are read directly (published data); everything that changes state goes through the schema's functions.
 */
export class WalletRepository {
  constructor(private readonly pool: Pool) {}

  async issuerBySlug(slug: string): Promise<IssuerRow | null> {
    const r = await this.pool.query('select * from wallet.issuer where slug = $1', [slug]);
    return r.rows[0] ? issuer(r.rows[0]) : null;
  }

  async issuerById(id: string): Promise<IssuerRow | null> {
    const r = await this.pool.query('select * from wallet.issuer where id = $1', [id]);
    return r.rows[0] ? issuer(r.rows[0]) : null;
  }

  async typesOf(issuerId: string): Promise<CredentialTypeRow[]> {
    const r = await this.pool.query('select * from wallet.credential_type where issuer_id = $1 order by vct', [issuerId]);
    return r.rows.map(type);
  }

  async typeByVct(vct: string): Promise<CredentialTypeRow | null> {
    const r = await this.pool.query('select * from wallet.credential_type where vct = $1', [vct]);
    return r.rows[0] ? type(r.rows[0]) : null;
  }

  async typeById(id: string): Promise<CredentialTypeRow | null> {
    const r = await this.pool.query('select * from wallet.credential_type where id = $1', [id]);
    return r.rows[0] ? type(r.rows[0]) : null;
  }

  async createOffer(typeId: string, subject: string, codeDigest: Buffer, txDigest: Buffer, ttlSeconds: number): Promise<{ offerId: string; expiresAt: Date } | 'too-many'> {
    try {
      const r = await this.pool.query('select * from wallet.create_offer($1, $2, $3, $4, $5)', [typeId, subject, codeDigest, txDigest, ttlSeconds]);
      return { offerId: r.rows[0].offer_id, expiresAt: r.rows[0].expires_at };
    } catch (e) {
      if ((e as { code?: string }).code === '54000') return 'too-many';
      throw e;
    }
  }

  async redeemOffer(codeDigest: Buffer, txDigest: Buffer, tokenDigest: Buffer, jkt: string, ttlSeconds: number): Promise<{ outcome: 'ok' | 'unknown' | 'wrong-tx-code' | 'locked'; expiresAt: Date | null }> {
    const r = await this.pool.query('select * from wallet.redeem_offer($1, $2, $3, $4, $5)', [codeDigest, txDigest, tokenDigest, jkt, ttlSeconds]);
    return { outcome: r.rows[0].outcome, expiresAt: r.rows[0].token_expires_at };
  }

  async tokenGrant(tokenDigest: Buffer): Promise<TokenGrant | null> {
    const r = await this.pool.query('select * from wallet.token_grant($1)', [tokenDigest]);
    const g = r.rows[0];
    if (!g || g.dpop_jkt === null) return null;
    return { dpopJkt: g.dpop_jkt, credentialTypeId: g.credential_type_id, issuerId: g.issuer_id, subjectPersonId: g.subject_person_id, usable: g.usable };
  }

  async issueWithToken(tokenDigest: Buffer, holderJkt: string, expiresAt: Date): Promise<{ issuedCredentialId: string; statusListId: string; statusIdx: number }> {
    const r = await this.pool.query('select * from wallet.issue_with_token($1, $2, $3)', [tokenDigest, holderJkt, expiresAt]);
    return { issuedCredentialId: r.rows[0].issued_credential_id, statusListId: String(r.rows[0].status_list_id), statusIdx: r.rows[0].status_idx };
  }

  async revokeIssuedInError(issuedCredentialId: string): Promise<void> {
    await this.pool.query("select wallet.set_credential_status($1, 'revoked', 'issued-in-error', 'issuer-system:oid4vci')", [issuedCredentialId]);
  }

  async newNonce(digest: Buffer, purpose: 'c_nonce' | 'vp', ttlSeconds: number): Promise<Date> {
    const r = await this.pool.query('select wallet.new_nonce($1, $2, $3) as e', [digest, purpose, ttlSeconds]);
    return r.rows[0].e;
  }

  async useNonce(digest: Buffer, purpose: 'c_nonce' | 'vp'): Promise<boolean> {
    const r = await this.pool.query('select wallet.use_nonce($1, $2) as ok', [digest, purpose]);
    return r.rows[0].ok === true;
  }

  async claimProofJti(digest: Buffer, ttlSeconds: number): Promise<boolean> {
    const r = await this.pool.query('select wallet.claim_proof_jti($1, $2) as ok', [digest, ttlSeconds]);
    return r.rows[0].ok === true;
  }

  async statusList(id: string): Promise<{ issuerId: string; bits: 1 | 2 | 4 | 8; size: number; bitmap: Buffer; version: string } | null> {
    if (!/^[0-9]{1,18}$/.test(id)) return null;
    const r = await this.pool.query('select issuer_id, bits, size, bitmap, version from wallet.status_list where id = $1', [id]);
    const s = r.rows[0];
    return s ? { issuerId: s.issuer_id, bits: s.bits, size: s.size, bitmap: s.bitmap, version: String(s.version) } : null;
  }

  /** Runs fn in a transaction whose rows are filtered to this person (SET LOCAL app.person_id; row-level security). */
  private async asPerson<T>(personId: string, fn: (c: PoolClient) => Promise<T>): Promise<T> {
    const c = await this.pool.connect();
    try {
      await c.query('begin');
      await c.query("select set_config('app.person_id', $1, true)", [personId]);
      const r = await fn(c);
      await c.query('commit');
      return r;
    } catch (e) {
      await c.query('rollback').catch(() => undefined);
      throw e;
    } finally {
      c.release();
    }
  }

  /** P4-API3: the person's wallet entries (DB3). */
  async listEntries(personId: string): Promise<WalletEntry[]> {
    return this.asPerson(personId, async (c) => (await c.query('select * from wallet.credential order by expires_at')).rows.map(entry));
  }

  async addEntry(personId: string, e: NewWalletEntry): Promise<WalletEntry | 'too-many'> {
    return this.asPerson(personId, async (c) => {
      if (Number((await c.query('select count(*) from wallet.credential')).rows[0].count) >= 200) return 'too-many';
      const r = await c.query(`insert into wallet.credential (person_id, vct, issuer_url, issued_at, expires_at, status_uri, status_idx, backup_ciphertext, backup_key_jkt)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning *`,
      [personId, e.vct, e.issuerUrl, e.issuedAt, e.expiresAt, e.statusUri, e.statusIdx, e.backupCiphertext, e.backupKeyId]);
      return entry(r.rows[0]);
    });
  }

  async deleteEntry(personId: string, id: string): Promise<boolean> {
    return this.asPerson(personId, async (c) => ((await c.query('delete from wallet.credential where id = $1', [id])).rowCount ?? 0) === 1);
  }

  async issuerByUrl(url: string): Promise<IssuerRow | null> {
    const r = await this.pool.query('select * from wallet.issuer where issuer_url = $1', [url]);
    return r.rows[0] ? issuer(r.rows[0]) : null;
  }

  async verifierByClientId(clientId: string): Promise<VerifierRow | null> {
    const r = await this.pool.query('select * from wallet.verifier where client_id = $1', [clientId]);
    const v = r.rows[0];
    return v ? {
      id: v.id, clientId: v.client_id, display: v.display, requestJwk: v.request_jwk, requestKid: v.request_kid, hsmTokenLabel: v.hsm_token_label,
      hsmKeyId: v.hsm_key_id, allowedVct: v.allowed_vct, allowedClaims: v.allowed_claims, status: v.status, tenantId: v.tenant_id,
    } : null;
  }

  // ---------------------------------------------------------------- revocation on request (P4-F5; doc phase-4/07)

  /** The credentials issued to this person (row-level security), newest first: type, issuer, status, dates. */
  async issuedTo(personId: string): Promise<IssuedView[]> {
    return this.asPerson(personId, async (c) => (await c.query(`select ic.id, ct.vct, i.slug as issuer, ic.status, ic.status_reason, ic.issued_at, ic.expires_at, ic.status_changed_at
        from wallet.issued_credential ic join wallet.credential_type ct on ct.id = ic.credential_type_id join wallet.issuer i on i.id = ic.issuer_id
       order by ic.issued_at desc`)).rows.map(issuedView));
  }

  /** The holder revokes one of their credentials; another person's is 'unknown'; revoking twice is a 'conflict'. */
  async holderRevoke(personId: string, issuedId: string, reason: string): Promise<'revoked' | 'unknown' | 'conflict' | 'invalid'> {
    try {
      await this.asPerson(personId, (c) => c.query('select wallet.holder_revoke($1, $2)', [issuedId, reason]));
      return 'revoked';
    } catch (e) {
      return statusError(e);
    }
  }

  async officerView(issuedId: string): Promise<(IssuedView & { history: unknown[] }) | null> {
    const r = (await this.pool.query('select * from wallet.issued_credential_view($1)', [issuedId])).rows[0];
    return r ? { ...issuedView(r), history: r.history } : null;
  }

  async officerSetStatus(issuedId: string, status: 'valid' | 'suspended' | 'revoked', reason: string, officer: string): Promise<'done' | 'unknown' | 'conflict' | 'invalid'> {
    try {
      await this.pool.query('select wallet.officer_set_status($1, $2, $3, $4)', [issuedId, status, reason, officer]);
      return 'done';
    } catch (e) {
      return statusError(e);
    }
  }

  async createPresentationRequest(clientId: string, tenantId: string | null, personId: string, nonce: string, state: string, vct: string, claims: string[], ttlSeconds: number):
    Promise<{ requestId: string; expiresAt: Date } | 'forbidden' | 'unknown'> {
    try {
      const r = await this.pool.query('select * from wallet.create_presentation_request($1, $2, $3, $4, $5, $6, $7, $8)', [clientId, tenantId, personId, nonce, state, vct, claims, ttlSeconds]);
      return { requestId: r.rows[0].request_id, expiresAt: r.rows[0].expires_at };
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === '42704') return 'unknown';
      if (code === '42501' || code === '22023') return 'forbidden';
      throw e;
    }
  }

  async openPresentationRequest(id: string): Promise<OpenRequest | null> {
    const r = (await this.pool.query('select * from wallet.open_presentation_request($1)', [id])).rows[0];
    if (!r || r.client_id === null) return null;
    return { clientId: r.client_id, nonce: r.nonce, state: r.state, vct: r.vct, claims: r.claims, expiresAt: r.expires_at, requestKid: r.request_kid,
      hsmTokenLabel: r.hsm_token_label, hsmKeyId: r.hsm_key_id, requestJwk: r.request_jwk };
  }

  private pending(r: Record<string, unknown> | undefined): PendingRequest | null {
    if (!r || r.request_id === null) return null;
    return { requestId: r.request_id as string, clientId: r.client_id as string, nonce: r.nonce as string, vct: r.vct as string, claims: r.claims as string[] };
  }

  async pendingByState(state: string): Promise<PendingRequest | null> {
    return this.pending((await this.pool.query('select * from wallet.pending_by_state($1)', [state])).rows[0]);
  }

  async pendingForStaff(id: string, personId: string): Promise<PendingRequest | null> {
    if (!/^[0-9a-f-]{36}$/.test(id)) return null;
    return this.pending((await this.pool.query('select * from wallet.pending_for_staff($1, $2)', [id, personId])).rows[0]);
  }

  async recordPresentation(requestId: string, result: 'accepted' | 'rejected', reason: string | null, types: string[], claimNames: string[], disclosed: Record<string, unknown> | null): Promise<boolean> {
    const r = await this.pool.query('select wallet.record_presentation($1, $2, $3, $4, $5, $6) as ok', [requestId, result, reason, types, claimNames, disclosed]);
    return r.rows[0].ok === true;
  }

  async readPresentation(id: string, personId: string): Promise<{ status: string; reason: string | null; disclosed: Record<string, unknown> | null }> {
    const r = (await this.pool.query('select * from wallet.read_presentation($1, $2)', [id, personId])).rows[0];
    return { status: r.status, reason: r.reason, disclosed: r.disclosed };
  }

  async presentationLog(tenantId: string, limit: number): Promise<Record<string, unknown>[]> {
    return (await this.pool.query('select * from wallet.presentation_log_of($1, $2)', [tenantId, limit])).rows;
  }

  /** P4-D5: reminders due across people (a definer function: the application role cannot list others' entries). */
  async dueReminders(limit: number): Promise<{ entryId: string; personId: string; vct: string; expiresAt: Date; threshold: number; renewalServiceSlug: string | null; display: Record<string, string> | null }[]> {
    const r = await this.pool.query('select * from wallet.due_reminders($1)', [limit]);
    return r.rows.map((x) => ({ entryId: x.entry_id, personId: x.person_id, vct: x.vct, expiresAt: x.expires_at, threshold: x.threshold, renewalServiceSlug: x.renewal_service_slug, display: x.display }));
  }

  async markReminded(entryId: string, threshold: number): Promise<boolean> {
    return (await this.pool.query('select wallet.mark_reminded($1, $2) as ok', [entryId, threshold])).rows[0].ok === true;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export interface IssuedView {
  id: string; vct: string; issuer: string; status: 'valid' | 'suspended' | 'revoked'; statusReason: string | null;
  issuedAt: Date; expiresAt: Date; statusChangedAt: Date | null;
}

const issuedView = (r: Record<string, any>): IssuedView => ({
  id: r.id, vct: r.vct, issuer: r.issuer, status: r.status, statusReason: r.status_reason, issuedAt: r.issued_at, expiresAt: r.expires_at, statusChangedAt: r.status_changed_at,
});

/** The schema's answers to a status change: not this person's or not found, already in that state or revoked, a reason that does not fit. */
function statusError(e: unknown): 'unknown' | 'conflict' | 'invalid' {
  const code = (e as { code?: string }).code;
  if (code === '23503') return 'unknown';
  if (code === '55000') return 'conflict';
  if (code === '22023' || code === '22P02') return 'invalid';
  throw e;
}
