import { createHash, randomBytes } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import type { VerifiedToken } from './token-verifier';

export interface PersonView {
  id: string;
  preferredLocale: string;
  accessibility: Record<string, unknown>;
  accounts: { realm: string; status: string; assuranceLevel: string }[];
}

export interface StaffContext {
  personId: string;
  tenantId: string;
  tenantAdmin: boolean;
}

export interface OrgUnitRow {
  id: string;
  parentId: string | null;
  kind: 'branch' | 'team';
  name: string;
  createdAt: Date;
}

export type LinkOutcome = 'linked' | 'refreshed' | 'rejected' | 'linked-elsewhere' | 'other-identity';

export interface IdentityClaimView {
  type: string;
  source: string;
  loa: string;
  verifiedAt: Date;
  expiresAt: Date | null;
}

export interface MandateRow {
  id: string;
  principal_id: string;
  agent_id: string | null;
  scopes: string[];
  status: string;
  valid_from: Date;
  expires_at: Date;
  created_at: Date;
  accepted_at: Date | null;
  revoked_at: Date | null;
}

// Never the invitation-code digest: it stays in the database.
const MANDATE_COLUMNS = 'id, principal_id, agent_id, scopes, status, valid_from, expires_at, created_at, accepted_at, revoked_at';

export const digest = (code: string): Buffer => createHash('sha256').update(code, 'utf8').digest();
export const newInvitationCode = (): string => randomBytes(32).toString('base64url');

/**
 * Database access for identity-access (schema iam only, ADR-001). Every query runs in a transaction with the
 * caller's person set (SET LOCAL app.person_id), so row-level security filters it; pooled connections cannot leak it.
 */
/** The outcome of a recovery attempt; personId and subject (the Keycloak user id) only when recovered. */
export interface RecoveryOutcome {
  outcome: 'recovered' | 'no-account' | 'level-too-low' | 'limited' | 'rejected';
  personId: string | null;
  subject: string | null;
}

export class IamRepository {
  constructor(private readonly pool: Pool) {
    // Without a listener, an idle connection lost during a database failover would crash the process (R26).
    pool.on('error', () => undefined);
  }

  /** Find or create the person behind a verified account (just-in-time provisioning). */
  async ensurePerson(token: VerifiedToken): Promise<string> {
    const r = await this.pool.query<{ id: string }>('select iam.ensure_person($1, $2, $3, $4) as id', [token.realm, token.subject, token.tenantId, token.locale]);
    return r.rows[0]!.id;
  }

  async asPerson<T>(personId: string, fn: (c: PoolClient) => Promise<T>): Promise<T> {
    const c = await this.pool.connect();
    try {
      await c.query('begin');
      await c.query("select set_config('app.person_id', $1, true)", [personId]);
      const out = await fn(c);
      await c.query('commit');
      return out;
    } catch (e) {
      await c.query('rollback').catch(() => undefined);
      throw e;
    } finally {
      c.release();
    }
  }

  me(personId: string): Promise<PersonView | null> {
    return this.asPerson(personId, async (c) => {
      const p = await c.query('select id, preferred_locale, accessibility from iam.person');
      if (!p.rows[0]) return null;
      const a = await c.query('select realm, status, assurance_level from iam.account order by created_at');
      return {
        id: p.rows[0].id,
        preferredLocale: p.rows[0].preferred_locale,
        accessibility: p.rows[0].accessibility,
        accounts: a.rows.map((x) => ({ realm: x.realm, status: x.status, assuranceLevel: x.assurance_level })),
      };
    });
  }

  updateMe(personId: string, patch: { preferredLocale?: string; accessibility?: Record<string, unknown> }): Promise<void> {
    return this.asPerson(personId, async (c) => {
      await c.query(
        `update iam.person set preferred_locale = coalesce($1, preferred_locale),
                accessibility = coalesce($2::jsonb, accessibility), updated_at = now()`,
        [patch.preferredLocale ?? null, patch.accessibility === undefined ? null : JSON.stringify(patch.accessibility)],
      );
    });
  }

  createMandate(personId: string, m: { scopes: string[]; validFrom: Date; expiresAt: Date }, code: string): Promise<MandateRow> {
    return this.asPerson(personId, async (c) => {
      const r = await c.query<{ id: string }>('select iam.create_mandate($1, $2, $3, $4) as id', [m.scopes, m.validFrom, m.expiresAt, digest(code)]);
      return (await c.query<MandateRow>(`select ${MANDATE_COLUMNS} from iam.mandate where id = $1`, [r.rows[0]!.id])).rows[0]!;
    });
  }

  listMandates(personId: string): Promise<MandateRow[]> {
    return this.asPerson(personId, async (c) => (await c.query<MandateRow>(`select ${MANDATE_COLUMNS} from iam.mandate order by created_at desc limit 200`)).rows);
  }

  getMandate(personId: string, id: string): Promise<MandateRow | null> {
    return this.asPerson(personId, async (c) => (await c.query<MandateRow>(`select ${MANDATE_COLUMNS} from iam.mandate where id = $1`, [id])).rows[0] ?? null);
  }

  acceptMandate(personId: string, id: string, code: string): Promise<boolean> {
    return this.asPerson(personId, async (c) => (await c.query<{ ok: boolean }>('select iam.accept_mandate($1, $2) as ok', [id, digest(code)])).rows[0]!.ok);
  }

  revokeMandate(personId: string, id: string): Promise<boolean> {
    return this.asPerson(personId, async (c) => (await c.query<{ ok: boolean }>('select iam.revoke_mandate($1) as ok', [id])).rows[0]!.ok);
  }

  /** Mandate actions, visible to both parties (P3-AC3); empty when the caller is not a party. */
  /** Starts acting under a mandate (P3-F6): the agent of an active, unexpired mandate only; recorded as an event. */
  actUnderMandate(personId: string, id: string): Promise<{ scopes: string[]; expiresAt: Date } | null> {
    return this.asPerson(personId, async (c) => {
      const r = await c.query<{ scopes: string[]; expires_at: Date }>('select * from iam.act_under_mandate($1)', [id]);
      return r.rows[0] ? { scopes: r.rows[0].scopes, expiresAt: r.rows[0].expires_at } : null;
    });
  }

  mandateEvents(personId: string, id: string): Promise<{ action: string; actorRole: 'principal' | 'agent'; at: Date }[]> {
    return this.asPerson(personId, async (c) => {
      const r = await c.query(
        `select e.action, case when e.actor_id = m.principal_id then 'principal' else 'agent' end as role, e.at
           from iam.mandate_event e join iam.mandate m on m.id = e.mandate_id where e.mandate_id = $1 order by e.id`,
        [id],
      );
      return r.rows.map((x) => ({ action: x.action, actorRole: x.role, at: x.at }));
    });
  }

  /** Records an activation e-mail for this address digest and says whether it may be sent now (no person context). */
  async registrationPermit(digest: Buffer, minIntervalMinutes: number): Promise<boolean> {
    const r = await this.pool.query<{ ok: boolean }>("select iam.registration_permit($1, make_interval(mins => $2)) as ok", [digest, minIntervalMinutes]);
    return r.rows[0]!.ok;
  }

  /**
   * A staff request: person, tenant and whether the caller administers the tenant are set for this transaction only,
   * from the verified token (the database functions decide with them; row-level security filters by tenant).
   */
  async asStaff<T>(staff: StaffContext, fn: (c: PoolClient) => Promise<T>): Promise<T> {
    return this.asPerson(staff.personId, async (c) => {
      await c.query("select set_config('app.tenant_id', $1, true), set_config('app.tenant_admin', $2, true)", [staff.tenantId, staff.tenantAdmin ? 'true' : 'false']);
      return fn(c);
    });
  }

  listUnits(staff: StaffContext): Promise<OrgUnitRow[]> {
    return this.asStaff(staff, async (c) => (await c.query<OrgUnitRow>(
      'select id, parent_id as "parentId", kind, name, created_at as "createdAt" from iam.org_unit order by kind, name limit 1000')).rows);
  }

  createUnit(staff: StaffContext, kind: string, name: string, parentId: string | null): Promise<string> {
    return this.asStaff(staff, async (c) => (await c.query<{ id: string }>('select iam.create_org_unit($1, $2, $3) as id', [kind, name, parentId])).rows[0]!.id);
  }

  unitMembers(staff: StaffContext, unitId: string): Promise<{ personId: string; role: string; grantedAt: Date }[]> {
    return this.asStaff(staff, async (c) => (await c.query(
      'select person_id as "personId", role, granted_at as "grantedAt" from iam.unit_members($1)', [unitId])).rows);
  }

  grantMembership(staff: StaffContext, personId: string, unitId: string, role: string): Promise<void> {
    return this.asStaff(staff, async (c) => { await c.query('select iam.grant_membership($1, $2, $3)', [personId, unitId, role]); });
  }

  revokeMembership(staff: StaffContext, personId: string, unitId: string): Promise<boolean> {
    return this.asStaff(staff, async (c) => (await c.query<{ ok: boolean }>('select iam.revoke_membership($1, $2) as ok', [personId, unitId])).rows[0]!.ok);
  }

  recordInvitation(staff: StaffContext, subject: string, unitId: string, role: string, expiresAt: Date): Promise<string> {
    return this.asStaff(staff, async (c) => (await c.query<{ id: string }>(
      'select iam.record_staff_invitation($1, $2, $3, $4) as id', [subject, unitId, role, expiresAt])).rows[0]!.id);
  }

  myMemberships(staff: StaffContext): Promise<{ unitId: string; kind: string; name: string; role: string }[]> {
    return this.asStaff(staff, async (c) => (await c.query(
      `select u.id as "unitId", u.kind, u.name, m.role from iam.membership m join iam.org_unit u on u.id = m.org_unit_id
        where m.person_id = iam.current_person() order by u.kind, u.name`)).rows);
  }

  /** Refreshes the authenticator mirror (P3-DB3) for the person's account in a realm; metadata only. */
  syncAuthenticators(personId: string, realm: string, items: { id: string; kind: string; label: string | null; createdAt: string | null }[]): Promise<void> {
    return this.asPerson(personId, async (c) => {
      await c.query('select iam.sync_authenticators($1, $2::jsonb)', [realm, JSON.stringify(items)]);
    });
  }

  /** Identity links (P3-API6): start an attempt; its state is stored as a digest only. */
  startIdentityLink(personId: string, stateDigest: Buffer, nonce: string, verifier: string, ttlSeconds: number): Promise<string> {
    return this.asPerson(personId, async (c) => (await c.query<{ id: string }>(
      'select iam.start_identity_link($1, $2, $3, $4) as id', [stateDigest, nonce, verifier, ttlSeconds])).rows[0]!.id);
  }

  /** The attempt's nonce and verifier, once; null when there is no such open attempt for this person and state. */
  claimIdentityLink(personId: string, id: string, stateDigest: Buffer): Promise<{ nonce: string; codeVerifier: string } | null> {
    return this.asPerson(personId, async (c) => {
      const r = await c.query<{ nonce: string; code_verifier: string }>('select * from iam.claim_identity_link($1, $2)', [id, stateDigest]);
      return { nonce: r.rows[0]!.nonce, codeVerifier: r.rows[0]!.code_verifier };
    }).catch((e: unknown) => {
      if ((e as { code?: string }).code === 'P0002') return null;
      throw e;
    });
  }

  /** Records the outcome of a claimed attempt; digest null when the eID refused. */
  finishIdentityLink(personId: string, id: string, digest: Buffer | null, source: string, loa: string | null): Promise<LinkOutcome> {
    return this.asPerson(personId, async (c) => (await c.query<{ outcome: LinkOutcome }>(
      'select iam.finish_identity_link($1, $2, $3, $4) as outcome', [id, digest, source, loa])).rows[0]!.outcome);
  }

  /** The person's verified identity claims: types, sources and levels only, never the digests. */
  identityClaims(personId: string): Promise<IdentityClaimView[]> {
    return this.asPerson(personId, async (c) => (await c.query<IdentityClaimView>(
      `select claim_type as type, source, loa, verified_at as "verifiedAt", expires_at as "expiresAt"
         from iam.identity_claim order by claim_type, source`)).rows);
  }

  /** The person's pairwise subjects per relying-party sector (P3-DB6); the person sees only their own rows. */
  pairwiseIds(personId: string): Promise<{ sector: string; subject: string }[]> {
    return this.asPerson(personId, async (c) => (await c.query<{ sector: string; subject: string }>(
      'select sector, pairwise_sub as subject from iam.pairwise_id order by sector')).rows);
  }

  mirrorPairwiseIds(personId: string, rows: { sector: string; subject: string }[]): Promise<void> {
    return this.asPerson(personId, async (c) => {
      for (const r of rows) await c.query('select iam.mirror_pairwise_id($1, $2)', [r.sector, r.subject]);
    });
  }

  /** Account recovery (P3-SEC4): no person until the eID's answer is matched; functions only. */
  async startRecovery(stateDigest: Buffer, nonce: string, verifier: string, ttlSeconds: number): Promise<string> {
    return (await this.pool.query<{ id: string }>('select iam.start_recovery($1, $2, $3, $4) as id', [stateDigest, nonce, verifier, ttlSeconds])).rows[0]!.id;
  }

  async claimRecovery(id: string, stateDigest: Buffer): Promise<{ nonce: string; codeVerifier: string } | null> {
    try {
      const r = await this.pool.query<{ nonce: string; code_verifier: string }>('select * from iam.claim_recovery($1, $2)', [id, stateDigest]);
      return { nonce: r.rows[0]!.nonce, codeVerifier: r.rows[0]!.code_verifier };
    } catch (e) {
      if ((e as { code?: string }).code === 'P0002') return null;
      throw e;
    }
  }

  async finishRecovery(id: string, digest: Buffer | null, loa: string | null): Promise<RecoveryOutcome> {
    const r = (await this.pool.query<{ outcome: RecoveryOutcome['outcome']; person_id: string | null; subject: string | null }>(
      'select * from iam.finish_recovery($1, $2, $3)', [id, digest, loa])).rows[0]!;
    return { outcome: r.outcome, personId: r.person_id, subject: r.subject };
  }

  /** Status-page challenges (P3-R2): no person; the functions decide whether a code may be sent and whether it is right. */
  async createStatusChallenge(id: string, referenceDigest: Buffer, codeDigest: Buffer, deliverable: boolean): Promise<boolean> {
    return (await this.pool.query<{ send: boolean }>('select iam.create_status_challenge($1, $2, $3, $4) as send', [id, referenceDigest, codeDigest, deliverable])).rows[0]!.send;
  }

  async verifyStatusChallenge(id: string, referenceDigest: Buffer, codeDigest: Buffer): Promise<boolean> {
    return (await this.pool.query<{ ok: boolean }>('select iam.verify_status_challenge($1, $2, $3) as ok', [id, referenceDigest, codeDigest])).rows[0]!.ok;
  }

  close(): Promise<void> {
    return this.pool.end();
  }
}
