import { strict as assert } from 'node:assert';
import { randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';
import { classify, type KeycloakEvent, type Kind, loadPollSeconds, SignInEventsService, SignInEventWatcher } from './signin-events';

// Event shapes as Keycloak 26.8.1 records them (probe of 26 Nov 2026, doc phase-3/15 §7).
const wrongPassword = (t: number, user = 'u1'): KeycloakEvent => ({ id: `p${t}`, time: t, type: 'LOGIN_ERROR', error: 'invalid_user_credentials', userId: user, details: { code_id: `c${t}`, username: 'alice' } });
const wrongCode = (t: number, user = 'u1'): KeycloakEvent => ({ id: `s${t}`, time: t, type: 'LOGIN_ERROR', error: 'invalid_user_credentials', userId: user, details: { code_id: `c${t}`, selected_credential_id: 'otp-1' } });
const login = (t: number, code = `c${t}`, user = 'u1'): KeycloakEvent => ({ id: `l${t}`, time: t, type: 'LOGIN', userId: user, details: { code_id: code, username: 'alice' } });
const update = (t: number, code: string, type = 'webauthn-passwordless'): KeycloakEvent => ({ id: `u${t}`, time: t, type: 'UPDATE_CREDENTIAL', userId: 'u1', details: { code_id: code, credential_type: type } });
const types = async (_u: string, id: string) => (id === 'otp-1' ? 'otp' : id === 'pk-1' ? 'webauthn-passwordless' : null);

describe('sign-in events: what each one means (ASVS V6.3.5, V6.3.7)', () => {
  it('failures: a wrong password, or a failure on a second-factor credential (right password, failed second step)', async () => {
    assert.deepEqual(await classify(wrongPassword(1), [], types), { kind: 'failure' });
    assert.deepEqual(await classify(wrongCode(1), [], types), { kind: 'second-factor-failure', credential: 'otp' });
    const sms = { ...wrongPassword(1), details: { code_id: 'c1', civora_second_factor: 'sms' } };
    assert.deepEqual(await classify(sms, [], types), { kind: 'second-factor-failure', credential: 'sms' }, 'a wrong SMS code (doc 17): the password was right');
    const passkey = { ...wrongCode(1), details: { selected_credential_id: 'pk-1' } };
    assert.deepEqual(await classify(passkey, [], types), { kind: 'failure' }, 'a passkey is a first factor: a plain failure');
    assert.equal(await classify({ ...wrongPassword(1), error: 'expired_code' }, [], types), null, 'not an authentication failure');
    assert.equal(await classify({ ...wrongPassword(1), userId: undefined }, [], types), null, 'unknown account: nobody to tell');
  });

  it('a way to sign in added inside a sign-in (an app asked for it) counts; one set by an activation or recovery link does not', async () => {
    const inApp = update(2, 'k1');
    assert.deepEqual(await classify(inApp, [inApp, login(3, 'k1')], types), { kind: 'credential-change', change: 'credential-added', credential: 'webauthn-passwordless' });
    assert.equal(await classify(update(2, 'k2', 'password'), [update(2, 'k2', 'password')], types), null);
    assert.deepEqual(await classify({ id: 'r', time: 4, type: 'REMOVE_CREDENTIAL', userId: 'u1', details: { credential_type: 'otp' } }, [], types),
      { kind: 'credential-change', change: 'credential-removed', credential: 'otp' });
    assert.deepEqual(await classify(login(5), [], types), { kind: 'success' });
    assert.equal(await classify({ id: 'x', time: 6, type: 'LOGOUT', userId: 'u1' }, [], types), null);
  });
});

describe('sign-in events: the watcher', () => {
  const setup = (events: KeycloakEvent[], nowMs: number) => {
    const seen = new Set<string>();
    const counts = new Map<string, number>();
    const sent: string[] = [];
    const recorded: Kind[] = [];
    const calls: { since: number; first: number }[] = [];
    const watcher = new SignInEventWatcher({
      realms: ['citizens'],
      events: async (_r, since, first, max) => { calls.push({ since, first }); return [...events].filter((e) => e.time >= since).sort((a, b) => b.time - a.time).slice(first, first + max); },
      credentialType: async (_r, u, id) => types(u, id),
      // A small stand-in for iam.record_signin_event (the database function is tested against PostgreSQL).
      record: async (event, account, kind) => {
        const k = event.toString('hex');
        if (seen.has(k)) return { notice: 'duplicate', failures: 0 };
        seen.add(k);
        recorded.push(kind);
        const a = account.toString('hex');
        if (kind === 'credential-change') return { notice: 'credential-change', failures: 0 };
        if (kind === 'success') { const n = counts.get(a) ?? 0; counts.set(a, 0); return { notice: n >= 3 ? 'signed-in-after-failures' : null, failures: n }; }
        const n = (counts.get(a) ?? 0) + 1;
        counts.set(a, n);
        return { notice: kind === 'second-factor-failure' ? 'second-factor-failed' : n === 5 ? 'failed-attempts' : null, failures: n };
      },
      notify: async (_r, _u, n) => { sent.push(n.count ? `${n.type}:${n.count}` : n.credential ? `${n.type}:${n.credential}` : n.type); },
      log: () => undefined,
      now: () => nowMs,
    }, randomBytes(32), { pageSize: 2, settleMs: 5_000 });
    return { watcher, sent, recorded, calls };
  };

  it('reads every page, handles events oldest first, tells the person once per event; young events wait for the next round', async () => {
    const t0 = 1_000_000;
    const events = [wrongPassword(t0), wrongPassword(t0 + 1), wrongCode(t0 + 2), login(t0 + 3), update(t0 + 4, 'k9'), login(t0 + 4, 'k9'),
      update(t0 + 9_000, 'kx'), login(t0 + 9_001, 'kx')];
    const { watcher, sent, recorded, calls } = setup(events, t0 + 10_000);
    assert.equal(await watcher.poll(), 3);
    assert.deepEqual(sent, ['second-factor-failed:3', 'signed-in-after-failures:3', 'credential-added:webauthn-passwordless']);
    assert.deepEqual(recorded, ['failure', 'failure', 'second-factor-failure', 'success', 'credential-change', 'success']);
    assert.deepEqual(calls.map((c) => c.first), [0, 2, 4, 6, 8], 'all pages, page size 2');
    // Next round, later: the events left for it are handled; the others are not sent again.
    const again = await watcher.poll.call(Object.assign(watcher, {}));
    assert.equal(again, 0, 'the clock did not move: nothing new is old enough');
  });

  it('a later round picks up what was too young, re-reading with an overlap, without repeating anything', async () => {
    const t0 = 2_000_000;
    let now = t0 + 6_000;
    const events = [update(t0, 'k1'), login(t0 + 1, 'k1'), wrongPassword(t0 + 4_000)];
    const s = setup(events, 0);
    (s.watcher as unknown as { deps: { now: () => number } }).deps.now = () => now;
    assert.equal(await s.watcher.poll(), 1);
    now = t0 + 30_000;
    events.push(wrongPassword(t0 + 15_000), wrongPassword(t0 + 15_500), login(t0 + 16_000));
    assert.equal(await s.watcher.poll(), 1);
    assert.deepEqual(s.sent, ['credential-added:webauthn-passwordless', 'signed-in-after-failures:3']);
    assert.ok(s.calls.at(-1)!.since < t0 + 6_000 - 5_000, 'the second round starts before the first one ended (overlap)');
  });

  it('settings: every 60 s by default, 2..600 s, or off', () => {
    assert.equal(loadPollSeconds({}), 60);
    assert.equal(loadPollSeconds({ SIGNIN_EVENTS_POLL_SECONDS: '2' }), 2);
    assert.equal(loadPollSeconds({ SIGNIN_EVENTS: 'off' }), 0);
    assert.throws(() => loadPollSeconds({ SIGNIN_EVENTS_POLL_SECONDS: '1' }), /between 2 and 600/);
    assert.throws(() => loadPollSeconds({ SIGNIN_EVENTS_POLL_SECONDS: 'x' }), /between 2 and 600/);
  });

  it('the service runs one round at a time and survives a failing round', async () => {
    let running = 0;
    let max = 0;
    const logs: unknown[] = [];
    const watcher = { poll: async () => { running++; max = Math.max(max, running); await new Promise((r) => setTimeout(r, 20)); running--; throw new Error('keycloak down'); } } as unknown as SignInEventWatcher;
    const service = new SignInEventsService(watcher, 2, (e) => logs.push(e));
    await Promise.all([service.round(), service.round(), service.round()]);
    assert.equal(max, 1);
    assert.equal(logs.length, 1);
    const off = new SignInEventsService(null, 0, () => undefined);
    off.onModuleInit();
    off.onModuleDestroy();
  });
});
