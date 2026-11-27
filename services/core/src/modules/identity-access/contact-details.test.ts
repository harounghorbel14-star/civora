import { strict as assert } from 'node:assert';
import { randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';
import { MessageNotSent, type OutboundMessage } from '../integrations/public-api';
import { ChangeNotFound, type Channel, ContactDetails, ContactInUse, ContactRecovery, InvalidContact, loadRecoveryLinkOrigin, maskEmail, normalisePhone,
  NotDeliverable, RecoveryLinkNotFound, SameContact, TooManyChanges, WrongCode } from './contact-details';
import type { ContactDirectory, ContactRecord } from './keycloak-admin';
import type { VerifiedToken } from './token-verifier';

const token = (subject = 'u1', realm: 'citizens' | 'staff' = 'citizens') => ({ realm, subject } as VerifiedToken);

function fakeDirectory(users: ContactRecord[]) {
  const calls: string[] = [];
  const dir: ContactDirectory = {
    get: async (id) => users.find((u) => u.id === id) ?? null,
    findByEmail: async (e) => users.find((u) => u.email === e) ?? null,
    setEmail: async (id, email) => {
      calls.push(`email:${id}:${email}`);
      if (users.some((u) => u.email === email && u.id !== id)) return 'in-use';
      users.find((u) => u.id === id)!.email = email;
      return 'updated';
    },
    setPhone: async (id, phone) => {
      calls.push(`phone:${id}:${phone}`);
      Object.assign(users.find((u) => u.id === id)!, { phone, phoneVerified: !!phone });
    },
  };
  return { dir, calls };
}

/** A stand-in for iam.start/confirm_contact_change (the functions themselves are tested against PostgreSQL). */
function fakeChanges(limit = 5) {
  const rows = new Map<string, { account: string; channel: Channel; target: string; code: string; attempts: number; done: boolean }>();
  return {
    start: async (id: string, account: Buffer, channel: Channel, target: string, code: Buffer) => {
      if ([...rows.values()].filter((r) => r.account === account.toString('hex')).length >= limit) return false;
      rows.set(id, { account: account.toString('hex'), channel, target, code: code.toString('hex'), attempts: 0, done: false });
      return true;
    },
    confirm: async (id: string, account: Buffer, code: Buffer) => {
      const r = rows.get(id);
      if (!r || r.done || r.account !== account.toString('hex') || r.attempts >= 5) return { outcome: 'not-found' as const, channel: null, target: null, attemptsLeft: 0 };
      if (r.code !== code.toString('hex')) { r.attempts++; return { outcome: 'wrong-code' as const, channel: null, target: null, attemptsLeft: 5 - r.attempts }; }
      r.done = true;
      return { outcome: 'confirmed' as const, channel: r.channel, target: r.target, attemptsLeft: 0 };
    },
  };
}

const codeIn = (m: OutboundMessage | undefined): string => /(\d{6})/.exec(m?.text ?? '')![1]!;

function setup(opts: { fail?: boolean; limit?: number } = {}) {
  const users: ContactRecord[] = [
    { id: 'u1', email: 'amina@example.invalid', locale: 'fr', phone: null, phoneVerified: false, enabled: true },
    { id: 'u2', email: 'taken@example.invalid', locale: null, phone: null, phoneVerified: false, enabled: true },
  ];
  const { dir, calls } = fakeDirectory(users);
  const sent: OutboundMessage[] = [];
  const messaging = { send: async (m: OutboundMessage) => { if (opts.fail) throw new MessageNotSent('no'); sent.push(m); } } as never;
  const svc = new ContactDetails({ directories: { citizens: dir }, messaging, changes: fakeChanges(opts.limit), digestKey: randomBytes(32), log: () => undefined });
  return { svc, users, calls, sent };
}

describe('contact details: e-mail change (ASVS 5.0 V6.3.7; doc phase-3/16)', () => {
  it('a code goes to the NEW address in the account language; with it the address changes and BOTH addresses are told', async () => {
    const { svc, users, calls, sent } = setup();
    const ch = await svc.start(token(), 'email', '  Amina.New@Example.invalid ', 'c1');
    assert.equal(ch.channel, 'email');
    assert.equal(sent.length, 1);
    assert.equal(sent[0]!.to, 'amina.new@example.invalid', 'the address is normalised');
    assert.match(sent[0]!.subject, /Code de confirmation/, 'the account language (fr)');
    assert.equal(calls.length, 0, 'nothing changes before the code');
    const wrong = codeIn(sent[0]) === '000000' ? '111111' : '000000';
    await assert.rejects(svc.confirm(token(), ch.id, wrong, 'c2'), (e: unknown) => { assert.ok(e instanceof WrongCode, String(e)); assert.equal(e.attemptsLeft, 4); return true; });
    assert.deepEqual(await svc.confirm(token(), ch.id, codeIn(sent[0]), 'c3'), { channel: 'email', value: 'amina.new@example.invalid' });
    assert.deepEqual(calls, ['email:u1:amina.new@example.invalid']);
    assert.equal(users[0]!.email, 'amina.new@example.invalid');
    const [old, now] = [sent[1]!, sent[2]!];
    assert.equal(old.to, 'amina@example.invalid', 'the OLD address is told');
    assert.match(old.text, /a•••@example\.invalid/, 'only a masked form of the new address');
    assert.doesNotMatch(old.text, /amina\.new/);
    assert.equal(now.to, 'amina.new@example.invalid');
    await assert.rejects(svc.confirm(token(), ch.id, codeIn(sent[0]), 'c4'), ChangeNotFound, 'single use');
  });

  it('refuses a malformed value, the current address, a sixth change a day, an undeliverable address; another account cannot confirm', async () => {
    const { svc, sent } = setup({ limit: 1 });
    await assert.rejects(svc.start(token(), 'email', 'not-an-address', 'c'), InvalidContact);
    await assert.rejects(svc.start(token(), 'fax', 'x', 'c'), InvalidContact);
    await assert.rejects(svc.start(token(), 'email', 'AMINA@example.invalid', 'c'), SameContact);
    const ch = await svc.start(token(), 'email', 'other@example.invalid', 'c');
    await assert.rejects(svc.start(token(), 'email', 'third@example.invalid', 'c'), TooManyChanges);
    await assert.rejects(svc.confirm(token('u2'), ch.id, codeIn(sent[0]), 'c'), ChangeNotFound, 'bound to the account that started it');
    await assert.rejects(svc.confirm(token(), ch.id, '12345', 'c'), (e: unknown) => e instanceof WrongCode && e.attemptsLeft === -1, 'not six digits');
    await assert.rejects(setup({ fail: true }).svc.start(token(), 'email', 'x@example.invalid', 'c'), NotDeliverable);
  });

  it('an address used by another account is refused at confirmation (after the code: no enumeration without the mailbox)', async () => {
    const { svc, sent, calls } = setup();
    const ch = await svc.start(token(), 'email', 'taken@example.invalid', 'c');
    assert.equal(sent.length, 1, 'the code is sent like for any address');
    await assert.rejects(svc.confirm(token(), ch.id, codeIn(sent[0]), 'c'), ContactInUse);
    assert.deepEqual(calls, [], 'nothing changed');
  });
});

describe('contact details: phone number', () => {
  it('an SMS code to the new number; with it the number is set as verified and the account address is told (last two digits only)', async () => {
    const { svc, users, sent } = setup();
    await assert.rejects(svc.start(token(), 'phone', '12345', 'c'), InvalidContact);
    assert.equal(normalisePhone('00216 00 000 001'), '+21600000001');
    assert.equal(normalisePhone('216 00 000 001'), null, 'international form only (+ or 00)');
    const ch = await svc.start(token(), 'phone', '+216 00 000 001', 'c');
    assert.equal(sent[0]!.to, '+21600000001');
    assert.ok(sent[0]!.text.length <= 160, 'an SMS');
    assert.deepEqual((await svc.view(token())).phone, null, 'not shown until verified');
    await svc.confirm(token(), ch.id, codeIn(sent[0]), 'c');
    assert.deepEqual(await svc.view(token()), { email: 'amina@example.invalid', phone: '+21600000001', phoneVerified: true });
    assert.equal(sent[1]!.to, 'amina@example.invalid');
    assert.match(sent[1]!.text, /se terminant par 01/);
    assert.doesNotMatch(sent[1]!.text, /21600000001/);
    await assert.rejects(svc.start(token(), 'phone', '+21600000001', 'c'), SameContact);
    assert.equal(await svc.removePhone(token(), 'c'), 'removed');
    assert.equal(users[0]!.phone, null);
    assert.match(sent.at(-1)!.subject, /retiré/);
    assert.equal(await svc.removePhone(token(), 'c'), 'none');
    assert.equal(maskEmail('x@y.example'), 'x•••@y.example');
  });

  it('a failing notice never undoes the change', async () => {
    const { svc, users, sent } = setup();
    const ch = await svc.start(token(), 'phone', '+21600000002', 'c');
    const code = codeIn(sent[0]);
    (svc as unknown as { deps: { messaging: { send: () => Promise<void> } } }).deps.messaging.send = async () => { throw new Error('relay down'); };
    await svc.confirm(token(), ch.id, code, 'c');
    assert.equal(users[0]!.phone, '+21600000002');
  });
});

describe('recovery R4: e-mailed link AND SMS code (doc phase-3/16)', () => {
  function recovery(users: ContactRecord[]) {
    const { dir } = fakeDirectory(users);
    const sent: OutboundMessage[] = [];
    const resets: string[] = [];
    const rows = new Map<string, { subject: string; phone: string | null; lang: 'ar' | 'fr' | 'en'; link: string; code?: string; attempts: number; done: boolean }>();
    const svc = new ContactRecovery({
      directory: dir, messaging: { send: async (m: OutboundMessage) => { sent.push(m); } } as never, digestKey: randomBytes(32), appOrigin: 'https://app.example.invalid',
      reset: { reset: async (id) => { resets.push(id); const u = users.find((x) => x.id === id)!; return { email: u.email!, locale: u.locale }; } },
      attempts: {
        start: async (id, _e, _a, subject, phone, lang, link) => { rows.set(id, { subject, phone, lang, link: link.toString('hex'), attempts: 0, done: false }); return true; },
        code: async (id, link, code) => {
          const r = rows.get(id);
          if (!r || !r.phone || r.done || r.link !== link.toString('hex')) return null;
          r.code = code.toString('hex');
          return { phone: r.phone, lang: r.lang, codeExpiresAt: new Date(Date.now() + 600_000) };
        },
        complete: async (id, link, code) => {
          const r = rows.get(id);
          if (!r || r.done || !r.code || r.link !== link.toString('hex')) return { outcome: 'not-found', subject: null, attemptsLeft: 0 };
          if (r.code !== code.toString('hex')) return { outcome: 'wrong-code', subject: null, attemptsLeft: 4 - r.attempts++ };
          r.done = true;
          return { outcome: 'recovered', subject: r.subject, attemptsLeft: 0 };
        },
      },
      log: () => undefined,
    });
    const settle = () => Promise.all([...svc.pending]);
    return { svc, sent, resets, settle };
  }

  it('unknown address: same answer, nothing sent; an account without a verified phone gets advice, not a link', async () => {
    const { svc, sent, settle } = recovery([{ id: 'u1', email: 'amina@example.invalid', locale: 'en', phone: '+21600000003', phoneVerified: false, enabled: true }]);
    assert.equal(svc.request('nobody@example.invalid', 'fr-TN', 'c'), true);
    assert.equal(svc.request('not an address', 'fr-TN', 'c'), false, 'malformed: refused before anything');
    await settle();
    assert.equal(sent.length, 0);
    svc.request('amina@example.invalid', 'fr-TN', 'c');
    await settle();
    assert.equal(sent.length, 1);
    assert.match(sent[0]!.subject, /Recovering your CIVORA account/, 'the account language first');
    assert.match(sent[0]!.text, /no confirmed phone number/);
    assert.doesNotMatch(sent[0]!.text, /https:/, 'no link');
  });

  it('the link, then an SMS code to the verified number; both needed; then every way to sign in is reset and the person is told twice', async () => {
    const { svc, sent, resets, settle } = recovery([{ id: 'u1', email: 'amina@example.invalid', locale: 'ar', phone: '+21600000004', phoneVerified: true, enabled: true }]);
    svc.request('amina@example.invalid', 'fr-TN', 'c');
    await settle();
    assert.equal(sent.length, 1, 'only the e-mail: no SMS before the link is followed');
    assert.equal(sent[0]!.to, 'amina@example.invalid');
    const link = new URL(/https:\/\/\S+/.exec(sent[0]!.text)![0]);
    assert.equal(link.origin + link.pathname, 'https://app.example.invalid/recover-link');
    const [a, t] = [link.searchParams.get('a')!, link.searchParams.get('t')!];
    assert.equal(link.searchParams.get('l'), 'ar');
    await assert.rejects(svc.sendCode(a, 'x'.repeat(43), 'c'), RecoveryLinkNotFound, 'a code needs the link token');
    await assert.rejects(svc.complete(a, t, '123456', 'c'), RecoveryLinkNotFound, 'the link alone recovers nothing');
    const sentCode = await svc.sendCode(a, t, 'c');
    assert.equal(sentCode.phoneEnding, '04');
    const sms = sent[1]!;
    assert.equal(sms.to, '+21600000004');
    assert.match(sms.text, /رمز استعادة/, 'the SMS in the account language');
    await assert.rejects(svc.complete(a, t, codeIn(sms) === '000000' ? '111111' : '000000', 'c'), (e: unknown) => e instanceof WrongCode && e.attemptsLeft === 4);
    assert.deepEqual(resets, []);
    await svc.complete(a, t, codeIn(sms), 'c');
    assert.deepEqual(resets, ['u1']);
    assert.deepEqual(sent.slice(2).map((m) => m.to), ['amina@example.invalid', '+21600000004'], 'notice by e-mail and by SMS');
    await assert.rejects(svc.complete(a, t, codeIn(sms), 'c'), RecoveryLinkNotFound, 'single use');
  });

  it('the link opens the web app (https outside dev and test, an origin only)', () => {
    assert.equal(loadRecoveryLinkOrigin({ ACTIVATION_REDIRECT_URI: 'https://app.example.invalid/activated' }), 'https://app.example.invalid');
    assert.equal(loadRecoveryLinkOrigin({ RECOVERY_LINK_ORIGIN: 'http://localhost:3000', CIVORA_ENV: 'dev' }), 'http://localhost:3000');
    assert.throws(() => loadRecoveryLinkOrigin({ RECOVERY_LINK_ORIGIN: 'http://app.example.invalid', CIVORA_ENV: 'prod' }), /https/);
    assert.throws(() => loadRecoveryLinkOrigin({ RECOVERY_LINK_ORIGIN: 'https://app.example.invalid/x' }), /an origin/);
  });
});
