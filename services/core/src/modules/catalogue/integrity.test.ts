import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import { b64u, softwareKey } from '@civora/credentials';
import { register } from '@prometheus-io/client';
import type { CatalogueRepository } from './catalogue.repository';
import { CONTENT_TYP } from './content-signature';
import { IntegrityMonitor, median } from './integrity';

/** The directory's integrity monitor (P5-SEC3) and freshness measure (P5-AC2), on a stand-in repository. */
const key = softwareKey({ kid: 'catalogue-content-1' });
const sign = async (canonical: string, k = key) => {
  const h = b64u(JSON.stringify({ alg: 'ES256', kid: 'catalogue-content-1', typ: CONTENT_TYP }));
  return `${h}..${b64u(await k.sign(Buffer.from(`${h}.${b64u(canonical)}`, 'ascii')))}`;
};
const NOW = Date.parse('2026-11-28T12:00:00Z');

async function repoWith(rows: { code: string; version: number; state: string; approved: string; now: string | null; lastVerifiedOn: string; signer?: ReturnType<typeof softwareKey> }[]) {
  const versions = await Promise.all(rows.map(async (r, i) => ({ serviceId: `s${i}`, code: r.code, version: r.version, state: r.state, lastVerifiedOn: r.lastVerifiedOn,
    digest: createHash('sha256').update(r.approved, 'utf8').digest(), signature: await sign(r.approved, r.signer ?? key) })));
  const now = new Map(rows.map((r, i) => [`s${i}`, r.now]));
  return { signedVersions: async () => versions, canonical: async (id: string) => now.get(id) ?? null } as unknown as CatalogueRepository;
}
const metric = async (name: string) => (await register.getSingleMetric(name)!.get()).values[0]?.value;

describe('catalogue integrity monitor (Phase 5, P5-SEC3, P5-AC2)', () => {
  it('median', () => {
    assert.equal(median([]), null);
    assert.equal(median([5]), 5);
    assert.equal(median([9, 1, 5]), 5);
    assert.equal(median([1, 2, 3, 10]), 2.5);
  });

  it('content as approved passes; changed rows, a missing version or another key fail; freshness measured', async () => {
    const logs: Record<string, unknown>[] = [];
    const repo = await repoWith([
      { code: 'TN-CIV-001', version: 1, state: 'superseded', approved: '{"v":1}', now: '{"v":1}', lastVerifiedOn: '2026-01-01' },
      { code: 'TN-CIV-001', version: 2, state: 'published', approved: '{"v":2}', now: '{"v":2}', lastVerifiedOn: '2026-11-18' },
      { code: 'TN-CIV-002', version: 1, state: 'published', approved: '{"fee":2}', now: '{"fee":20}', lastVerifiedOn: '2026-11-08' },
      { code: 'TN-CIV-003', version: 1, state: 'published', approved: '{"a":1}', now: null, lastVerifiedOn: '2026-07-01' },
      { code: 'TN-CIV-004', version: 1, state: 'published', approved: '{"b":1}', now: '{"b":1}', lastVerifiedOn: '2026-11-28', signer: softwareKey({ kid: 'catalogue-content-1' }) },
    ]);
    const r = await new IntegrityMonitor(repo, async () => ({ ...key.publicJwk, kid: 'catalogue-content-1' }), (e) => logs.push(e), () => NOW).runOnce();
    assert.deepEqual(r.failures, [
      { code: 'TN-CIV-002', version: 1, reason: 'digest' },
      { code: 'TN-CIV-003', version: 1, reason: 'missing' },
      { code: 'TN-CIV-004', version: 1, reason: 'signature' },
    ]);
    assert.equal(r.checked, 5);
    assert.equal(r.signatures, 3, 'a digest that does not match is not verified further');
    assert.equal(r.published, 4);
    assert.equal(r.medianAgeDays, (10 + 20) / 2, 'ages 10, 20, 150, 0 → median 15');
    assert.equal(r.stale, 1, 'one published service last verified more than 90 days ago');
    assert.equal(logs.length, 3);
    assert.ok(logs.every((l) => l.level === 'error' && !JSON.stringify(l).includes('fee')), 'one line per failure, no content');
    assert.equal(await metric('civora_catalogue_integrity_failures'), 3);
    assert.equal(await metric('civora_catalogue_last_verified_median_age_days'), 15);
    assert.equal(await metric('civora_catalogue_stale_services'), 1);
    assert.equal(await metric('civora_catalogue_integrity_last_run_timestamp_seconds'), NOW / 1000);
  });

  it('without the content key, digests are still checked and no signature is claimed', async () => {
    const repo = await repoWith([
      { code: 'TN-CIV-001', version: 1, state: 'published', approved: '{"v":1}', now: '{"v":1}', lastVerifiedOn: '2026-11-20' },
      { code: 'TN-CIV-002', version: 1, state: 'published', approved: '{"v":1}', now: '{"v":2}', lastVerifiedOn: '2026-11-20' },
    ]);
    const r = await new IntegrityMonitor(repo, async () => null, () => undefined, () => NOW).runOnce();
    assert.deepEqual(r.failures, [{ code: 'TN-CIV-002', version: 1, reason: 'digest' }]);
    assert.equal(r.signatures, 0);
    assert.equal(await metric('civora_catalogue_integrity_signatures_checked'), 0);
  });
});
