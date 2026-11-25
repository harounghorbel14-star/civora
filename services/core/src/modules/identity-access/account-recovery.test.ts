import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import { EidRejected, type MessagingChannel, type NationalEid, type OutboundMessage } from '../integrations/public-api';
import { AccountRecovery, RecoveryNotFound, RecoveryRejected, type RecoveryDeps } from './account-recovery';
import type { RecoveryOutcome } from './iam.repository';

const sha = (s: string): Buffer => createHash('sha256').update(s, 'utf8').digest();

function setup(opts: { outcome?: RecoveryOutcome['outcome']; eid?: 'ok' | 'rejected'; contact?: { email: string; locale: string | null } | null } = {}) {
  const calls: { finish: (Buffer | null | string)[][]; reset: string[]; sent: OutboundMessage[]; logs: Record<string, unknown>[]; state?: string } = { finish: [], reset: [], sent: [], logs: [] };
  const eid = {
    registration: {} as never, mode: 'simulated' as never, claimSource: 'eid-simulated',
    authorizationUrl: (r: { state: string }) => { calls.state = r.state; return `https://eid.invalid/auth?state=${r.state}`; },
    complete: async () => {
      if (opts.eid === 'rejected') throw new EidRejected('refused');
      return { nationalId: '99123456', loa: 'substantial' as const, authenticatedAt: new Date() };
    },
  } satisfies NationalEid;
  const messaging = { registration: {} as never, mode: 'simulated' as never, send: async (m: OutboundMessage) => { calls.sent.push(m); } } satisfies MessagingChannel;
  let stateDigest: Buffer | null = null;
  const deps: RecoveryDeps = {
    eid, messaging, digestKey: Buffer.alloc(32, 7),
    directory: { reset: async (subject) => { calls.reset.push(subject); return opts.contact === undefined ? { email: 'a@example.invalid', locale: 'fr-TN' } : opts.contact; } },
    attempts: {
      start: async (d) => { stateDigest = d; return '11111111-1111-4111-8111-111111111111'; },
      claim: async (_id, d) => (stateDigest && d.equals(stateDigest) ? { nonce: 'n'.repeat(43), codeVerifier: 'v'.repeat(43) } : null),
      finish: async (id, digest, loa) => {
        calls.finish.push([id, digest, loa]);
        const outcome = digest === null ? 'rejected' : opts.outcome ?? 'recovered';
        return { outcome, personId: outcome === 'recovered' ? 'p1' : null, subject: outcome === 'recovered' ? 'kc-user-1' : null };
      },
    },
    log: (e) => calls.logs.push(e),
  };
  return { recovery: new AccountRecovery(deps), calls };
}
const settle = (r: AccountRecovery) => Promise.all([...r.pending]);

describe('account recovery (P3-SEC4)', () => {
  it('start: an attempt bound to a random state (only its digest is stored) and an eID URL', async () => {
    const { recovery, calls } = setup();
    const a = await recovery.start('fr-TN');
    assert.match(a.authorizationUrl, /^https:\/\/eid\.invalid\/auth\?state=/);
    assert.match(calls.state!, /^[A-Za-z0-9_-]{43}$/);
  });

  it('a wrong state finds nothing (404 at the API), and nothing is reset', async () => {
    const { recovery, calls } = setup();
    const a = await recovery.start();
    await assert.rejects(recovery.complete(a.id, 'code', 'x'.repeat(43), 'c'), RecoveryNotFound);
    assert.equal(calls.reset.length, 0);
  });

  it('an identity linked to an account: ways to sign in reset by subject, notice in the person\'s language, no identifier logged', async () => {
    const { recovery, calls } = setup();
    const a = await recovery.start();
    await recovery.complete(a.id, 'code', calls.state!, 'c');
    await settle(recovery);
    assert.deepEqual(calls.reset, ['kc-user-1']);
    assert.equal(calls.sent.length, 1);
    assert.equal(calls.sent[0]!.to, 'a@example.invalid');
    assert.match(calls.sent[0]!.subject, /récupéré/);
    assert.ok(Buffer.isBuffer(calls.finish[0]![1]) && (calls.finish[0]![1] as Buffer).length === 32, 'a keyed digest, not the identifier');
    assert.ok(!JSON.stringify(calls.logs).includes('99123456'));
    assert.ok(!sha('99123456').equals(calls.finish[0]![1] as Buffer), 'keyed, not a plain hash');
  });

  for (const outcome of ['no-account', 'level-too-low', 'limited'] as const) {
    it(`${outcome}: the same answer, nothing reset, nothing sent`, async () => {
      const { recovery, calls } = setup({ outcome });
      const a = await recovery.start();
      await recovery.complete(a.id, 'code', calls.state!, 'c');
      await settle(recovery);
      assert.equal(calls.reset.length, 0);
      assert.equal(calls.sent.length, 0);
      assert.equal(calls.logs[0]!.outcome, outcome);
    });
  }

  it('the answer does not wait for the reset (timing says nothing about an account)', async () => {
    const { recovery, calls } = setup();
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const original = recovery['deps'].directory.reset;
    recovery['deps'].directory.reset = async (s) => { await gate; return original(s); };
    const a = await recovery.start();
    await recovery.complete(a.id, 'code', calls.state!, 'c');
    assert.equal(calls.reset.length, 0, 'complete resolved before the reset ran');
    release();
    await settle(recovery);
    assert.equal(calls.reset.length, 1);
  });

  it('the eID refuses: recorded as rejected, 422 at the API', async () => {
    const { recovery, calls } = setup({ eid: 'rejected' });
    const a = await recovery.start();
    await assert.rejects(recovery.complete(a.id, 'code', calls.state!, 'c'), RecoveryRejected);
    assert.equal(calls.finish[0]![1], null);
  });

  it('a disabled or deleted account: nothing sent', async () => {
    const { recovery, calls } = setup({ contact: null });
    const a = await recovery.start();
    await recovery.complete(a.id, 'code', calls.state!, 'c');
    await settle(recovery);
    assert.equal(calls.sent.length, 0);
    assert.equal(calls.logs[0]!.outcome, 'account-unavailable');
  });
});
