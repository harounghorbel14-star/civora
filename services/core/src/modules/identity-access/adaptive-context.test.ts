import { strict as assert } from 'node:assert';
import { randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';
import { AdaptiveControls, type AdaptiveDeps, browserFamily, loadAdaptiveConfig, type Outcome, resolveSignal } from './adaptive-context';

const KEY = randomBytes(32);
const CFG = loadAdaptiveConfig({});
const CHROME = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const FIREFOX = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0';
const DEVICE = 'D'.repeat(43);
const token = (o: Partial<{ clientId: string | null; jkt: string | null; sessionId: string | null }> = {}) =>
  ({ realm: 'citizens' as const, sessionId: 'sid-1', clientId: 'civora-web', jkt: 'J'.repeat(43), ...o });

describe('adaptive controls: signals (ASVS V8.2.4; doc phase-3/15)', () => {
  it('browser family: browser and system without versions', () => {
    assert.equal(browserFamily(CHROME), 'Chrome · Linux');
    assert.equal(browserFamily(FIREFOX), 'Firefox · Windows');
    assert.equal(browserFamily('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/131 Safari/537.36 Edg/131.0'), 'Edge · Windows');
    assert.equal(browserFamily('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'), 'Safari · iOS');
    assert.equal(browserFamily('Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36'), 'Chrome · Android');
    assert.equal(browserFamily('Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/131.0.0.0 Safari/537.36'), 'Chrome · Linux');
    assert.equal(browserFamily(undefined), 'Other · Other');
    assert.equal(browserFamily('node'), 'Other · Other');
  });

  it('the web app forwards its device cookie (digest) and the browser: trusted only on its DPoP-bound tokens', () => {
    const fwd = { 'civora-device': DEVICE, 'civora-user-agent': CHROME, 'user-agent': 'node' };
    const s = resolveSignal(token(), fwd, CFG, KEY)!;
    assert.deepEqual([s.strength, s.label], ['device-cookie', 'Chrome · Linux']);
    assert.equal(s.device.length, 32);
    assert.ok(!s.device.toString('hex').includes(Buffer.from(DEVICE).toString('hex')), 'a keyed digest, not the forwarded value');
    // Same device, another session: same device digest, another session digest.
    const s2 = resolveSignal(token({ sessionId: 'sid-2' }), fwd, CFG, KEY)!;
    assert.ok(s.device.equals(s2.device) && !s.session.equals(s2.session));
    // Without DPoP (a bearer token claiming to be the web app) the forwarded headers are ignored: the request's own browser.
    const bearer = resolveSignal(token({ jkt: null }), fwd, CFG, KEY)!;
    assert.deepEqual([bearer.strength, bearer.label], ['browser', 'Other · Other']);
    // Another client cannot forward a device: its headers count for nothing.
    const other = resolveSignal(token({ clientId: 'civora-test-app', jkt: null }), fwd, CFG, KEY)!;
    assert.deepEqual([other.strength, other.label], ['browser', 'Other · Other']);
    // A malformed device header is ignored.
    assert.equal(resolveSignal(token(), { 'civora-device': 'x', 'civora-user-agent': CHROME }, CFG, KEY)!.strength, 'browser');
  });

  it('another DPoP client (the mobile app): its key is the device; no client session: nothing to check', () => {
    const s = resolveSignal(token({ clientId: 'civora-mobile' }), { 'user-agent': 'okhttp/4.12.0' }, CFG, KEY)!;
    assert.deepEqual([s.strength, s.label], ['device-key', 'Android app · Other']);
    assert.equal(resolveSignal(token({ sessionId: null }), {}, CFG, KEY), null);
    assert.equal(resolveSignal(token({ clientId: null }), {}, CFG, KEY), null);
    assert.deepEqual([...loadAdaptiveConfig({ CONTEXT_FORWARDING_CLIENTS: 'a, b' }).forwarders], ['a', 'b']);
  });
});

describe('adaptive controls: decisions', () => {
  const identity = { ...token(), subject: 'kc-1', personId: 'p-1', tenantId: null, locale: null, authTime: null, acr: null, roles: [] };
  const headers = { 'civora-device': DEVICE, 'civora-user-agent': CHROME };
  const run = async (outcome: Outcome, longAbsence = false, failNotice = false) => {
    const seen = { ended: [] as string[], notices: [] as string[], logs: 0 };
    const deps: AdaptiveDeps = {
      observe: async () => ({ outcome, longAbsence }),
      endSession: async (_realm, sid) => { seen.ended.push(sid); },
      notice: async (_realm, _subject, e) => { if (failNotice) throw new Error('mail down'); seen.notices.push(`${e.type}:${e.label}`); },
      log: () => { seen.logs++; },
    };
    const verdict = await new AdaptiveControls(deps, CFG, KEY).check(identity, headers);
    await new Promise((r) => setImmediate(r));
    return { verdict, ...seen };
  };

  it('the same session on the same device: allowed, nothing sent', async () => {
    assert.deepEqual(await run('same'), { verdict: 'allow', ended: [], notices: [], logs: 0 });
    assert.deepEqual((await run('new-known')).notices, []);
    assert.deepEqual((await run('first-device')).notices, [], 'no notice for the very first device');
  });

  it('a new session on a new device: allowed, the person is told (V6.3.5); after a long absence too', async () => {
    const r = await run('new-device');
    assert.deepEqual([r.verdict, r.notices], ['allow', ['new-device:Chrome · Linux']]);
    assert.deepEqual((await run('new-known', true)).notices, ['long-absence:Chrome · Linux']);
  });

  it('a session used from another device or browser: ended at Keycloak, refused, the person told; ended stays refused', async () => {
    for (const o of ['changed-device', 'changed-browser'] as const) {
      const r = await run(o);
      assert.deepEqual([r.verdict, r.ended, r.notices], ['deny', ['sid-1'], ['session-ended:Chrome · Linux']], o);
    }
    const again = await run('ended');
    assert.deepEqual([again.verdict, again.ended, again.notices], ['deny', [], []]);
  });

  it('a notice that cannot be sent never changes the decision', async () => {
    assert.equal((await run('new-device', false, true)).verdict, 'allow');
    assert.equal((await run('changed-device', false, true)).verdict, 'deny');
  });
});
