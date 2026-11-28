import { createHash } from 'node:crypto';
import { Gauge } from '@prometheus-io/client';
import type { JWK } from 'jose';
import type { CatalogueRepository } from './catalogue.repository';
import { verifyContent } from './content-signature';

/**
 * Integrity monitoring of the services directory (P5-SEC3; doc phase-5/04). On every run, each published and superseded
 * version's canonical content is rebuilt from the rows as they are now; its SHA-256 must be the digest fixed at
 * approval, and, when the cell has its content key, the stored signature must verify with that key. A row changed
 * outside the editorial workflow (directly in the database, or a restore gone wrong) fails both checks.
 * It also measures freshness: the median age of "last verified" over the published services (P5-AC2: under 90 days).
 * Results are Prometheus gauges (alert rules: infra/k8s/monitoring) and one log line per failure, without content.
 */
const failures = new Gauge({ name: 'civora_catalogue_integrity_failures', help: 'Published or superseded versions whose content no longer matches what was approved and signed' });
const checked = new Gauge({ name: 'civora_catalogue_integrity_versions_checked', help: 'Versions checked by the last integrity run' });
const signatures = new Gauge({ name: 'civora_catalogue_integrity_signatures_checked', help: 'Signatures verified by the last run (0 when the cell has no content key)' });
const lastRun = new Gauge({ name: 'civora_catalogue_integrity_last_run_timestamp_seconds', help: 'End of the last completed integrity run' });
const medianAge = new Gauge({ name: 'civora_catalogue_last_verified_median_age_days', help: 'Median age of last verified over published services (P5-AC2: < 90)' });
const stale = new Gauge({ name: 'civora_catalogue_stale_services', help: 'Published services last verified more than 90 days ago' });
const published = new Gauge({ name: 'civora_catalogue_published_services', help: 'Published services' });

export interface IntegrityFailure { code: string; version: number; reason: 'digest' | 'signature' | 'missing' }
export interface IntegrityResult { checked: number; signatures: number; failures: IntegrityFailure[]; published: number; medianAgeDays: number | null; stale: number }

const DAY = 86_400_000;

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export class IntegrityMonitor {
  constructor(private readonly repo: CatalogueRepository, private readonly key: () => Promise<JWK | null>,
    private readonly log: (entry: Record<string, unknown>) => void, private readonly now: () => number = Date.now) {}

  async runOnce(): Promise<IntegrityResult> {
    const key = await this.key().catch(() => null);
    const out: IntegrityResult = { checked: 0, signatures: 0, failures: [], published: 0, medianAgeDays: null, stale: 0 };
    const ages: number[] = [];
    for (const v of await this.repo.signedVersions()) {
      out.checked++;
      // Freshness counts every published service, whatever its integrity result.
      if (v.state === 'published') {
        out.published++;
        const age = Math.floor((this.now() - Date.parse(`${v.lastVerifiedOn}T00:00:00Z`)) / DAY);
        ages.push(age);
        if (age > 90) out.stale++;
      }
      const canonical = await this.repo.canonical(v.serviceId, v.version);
      if (canonical === null) {
        out.failures.push({ code: v.code, version: v.version, reason: 'missing' });
        continue;
      }
      if (!createHash('sha256').update(canonical, 'utf8').digest().equals(v.digest)) out.failures.push({ code: v.code, version: v.version, reason: 'digest' });
      else if (key) {
        out.signatures++;
        if (!(await verifyContent(canonical, v.signature, key))) out.failures.push({ code: v.code, version: v.version, reason: 'signature' });
      }
    }
    out.medianAgeDays = median(ages);
    for (const f of out.failures) this.log({ level: 'error', msg: 'catalogue content does not match its approval', code: f.code, version: f.version, reason: f.reason });
    failures.set(out.failures.length);
    checked.set(out.checked);
    signatures.set(out.signatures);
    published.set(out.published);
    stale.set(out.stale);
    if (out.medianAgeDays === null) medianAge.reset(); else medianAge.set(out.medianAgeDays);
    lastRun.set(Math.floor(this.now() / 1000));
    return out;
  }
}
