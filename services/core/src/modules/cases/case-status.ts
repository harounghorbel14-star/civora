import { generate } from '@civora/synthetic-data';

/**
 * What the public status page may show about a case (P3-R2), and where its one-time code goes. Phase 3: a SYNTHETIC
 * directory (dev and test only, generated from @civora/synthetic-data); Phase 6 replaces it with the case engine.
 */
export interface CaseStatusView {
  reference: string;
  institution: string;
  status: 'received' | 'in-analysis' | 'information-requested' | 'decided';
  /** Date (YYYY-MM-DD) of the latest status. */
  since: string;
  /** Contact on file for one-time codes. Never returned to the caller of the status page. */
  contactEmail: string;
}

export interface CaseStatusDirectory {
  find(reference: string): Promise<CaseStatusView | null>;
}

export class SyntheticCaseStatusDirectory implements CaseStatusDirectory {
  private readonly byRef = new Map<string, CaseStatusView>();

  constructor(seed: number, tenants: number, casesPerTenant: number) {
    const d = generate({ seed, tenants, casesPerTenant });
    const tenant = new Map(d.tenants.map((t) => [t.id, t.name]));
    const email = new Map(d.customers.map((c) => [c.id, c.email]));
    for (const c of d.cases) {
      this.byRef.set(c.reference, {
        reference: c.reference,
        institution: tenant.get(c.tenantId) ?? '',
        status: c.status,
        since: c.decidedOn ?? c.acknowledgedOn ?? c.receivedOn,
        contactEmail: email.get(c.customerId) ?? '',
      });
    }
  }

  async find(reference: string): Promise<CaseStatusView | null> {
    return this.byRef.get(reference) ?? null;
  }
}

/** Null outside dev and test, or when not enabled: the status page then answers 503. */
export function loadCaseStatusDirectory(env: NodeJS.ProcessEnv = process.env): CaseStatusDirectory | null {
  if (env.SYNTHETIC_CASES !== 'on') return null;
  if (!['dev', 'test'].includes(env.CIVORA_ENV ?? 'dev')) throw new Error('the synthetic case directory runs in dev and test only');
  return new SyntheticCaseStatusDirectory(Number(env.SYNTHETIC_CASES_SEED ?? 7), 2, 10);
}
