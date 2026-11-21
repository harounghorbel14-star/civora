import { createHash, randomBytes } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import type { VerifiedToken } from './token-verifier';

export interface PersonView {
  id: string;
  preferredLocale: string;
  accessibility: Record<string, unknown>;
  accounts: { realm: string; status: string; assuranceLevel: string }[];
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

  close(): Promise<void> {
    return this.pool.end();
  }
}
