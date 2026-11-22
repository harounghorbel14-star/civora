import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { codeDigest, normaliseReference, referenceDigest, StatusAccess } from './status-access';

const CASE = { reference: 'SYN-RC-1-00001', institution: 'Banque Exemple 1 (fictif)', status: 'decided' as const, since: '2026-11-10', contactEmail: 'client1.t1@synthetic.invalid' };

function harness(sendBound = 3) {
  const sent: { to: string; text: string; subject: string }[] = [];
  const logs: string[] = [];
  const rows = new Map<string, { ref: Buffer; code: Buffer; sent: boolean; tries: number; used: boolean }>();
  const svc = new StatusAccess({
    directory: { find: async (r) => (r === CASE.reference ? CASE : null) },
    messaging: { registration: { port: 'MessagingChannel', provider: 'fake', registerEntry: 'M-02', integrationClass: 3 }, mode: 'simulated', send: async (m) => { sent.push(m); } },
    challenges: {
      create: async (id, ref, code, deliverable) => {
        const recent = [...rows.values()].filter((r) => r.sent && r.ref.equals(ref)).length;
        const send = deliverable && recent < sendBound;
        rows.set(id, { ref, code, sent: send, tries: 0, used: false });
        return send;
      },
      verify: async (id, ref, code) => {
        const r = rows.get(id);
        if (!r || r.tries >= 5 || r.used) return false;
        r.tries++;
        if (r.sent && r.ref.equals(ref) && r.code.equals(code)) { r.used = true; return true; }
        return false;
      },
    },
    log: (e) => logs.push(JSON.stringify(e)),
  });
  return { svc, sent, logs, rows };
}
const flush = () => new Promise((r) => setImmediate(r));

describe('customer status page (P3-R2)', () => {
  it('the same answer for a known and an unknown reference; a code only to the contact on file', async () => {
    const { svc, sent } = harness();
    const a = await svc.start(CASE.reference, 'fr-TN', 'c1');
    const b = await svc.start('SYN-RC-9-99999', 'fr-TN', 'c2');
    assert.deepEqual(Object.keys(a!).sort(), Object.keys(b!).sort());
    assert.match(a!.challengeId, /^[0-9a-f-]{36}$/);
    await flush();
    assert.equal(sent.length, 1);
    assert.equal(sent[0]!.to, CASE.contactEmail);
    assert.match(sent[0]!.text, /\b\d{6}\b/);
    assert.match(sent[0]!.subject, /code CIVORA/);
  });
  it('the right code shows the status once; the contact on file is never returned', async () => {
    const { svc, sent } = harness();
    const c = await svc.start(CASE.reference.toLowerCase(), 'en', 'c');
    await flush();
    const code = sent[0]!.text.match(/\b(\d{6})\b/)![1]!;
    const s = await svc.verify(c!.challengeId, CASE.reference, code);
    assert.deepEqual(s, { reference: CASE.reference, institution: CASE.institution, status: 'decided', since: '2026-11-10' });
    assert.equal(await svc.verify(c!.challengeId, CASE.reference, code), null, 'single use');
  });
  it('wrong code, other reference, malformed input, unknown reference: null, never why', async () => {
    const { svc, sent } = harness();
    const c = await svc.start(CASE.reference, 'ar', 'c');
    await flush();
    const code = sent[0]!.text.match(/\b(\d{6})\b/)![1]!;
    const wrong = code === '000000' ? '000001' : '000000';
    assert.equal(await svc.verify(c!.challengeId, CASE.reference, wrong), null);
    assert.equal(await svc.verify(c!.challengeId, 'SYN-RC-1-00002', code), null, 'a code is bound to its reference');
    assert.equal(await svc.verify('not-a-uuid', CASE.reference, code), null);
    assert.equal(await svc.verify(c!.challengeId, CASE.reference, '12345'), null);
    const u = await svc.start('SYN-RC-9-99999', 'ar', 'c');
    assert.equal(await svc.verify(u!.challengeId, 'SYN-RC-9-99999', code), null);
    assert.equal(await svc.start('bad ref!', 'ar', 'c'), null, 'format only');
  });
  it('at most 3 codes per reference (the answer stays the same); the log carries no reference, code or address', async () => {
    const { svc, sent, logs } = harness();
    for (let i = 0; i < 5; i++) assert.ok(await svc.start(CASE.reference, 'ar', `c${i}`));
    await flush();
    assert.equal(sent.length, 3);
    assert.ok(!logs.join().includes(CASE.reference) && !logs.join().includes(CASE.contactEmail));
  });
  it('helpers: references normalised; digests bound to their purpose and challenge', () => {
    assert.equal(normaliseReference(' syn-rc-1-00001 '), 'SYN-RC-1-00001');
    assert.equal(normaliseReference('a b'), null);
    assert.notDeepEqual(codeDigest('a', '123456'), codeDigest('b', '123456'));
    assert.equal(referenceDigest('X').length, 32);
  });
});
