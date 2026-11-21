import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { AccountSecurity, canSignIn, loadStepUpMaxAge, recentlyAuthenticated, stepUpChallenge, type AuthenticatorView } from './account-security';
import type { AccountDirectory, IdpCredential, IdpSession } from './keycloak-admin';
import type { VerifiedToken } from './token-verifier';

const now = Math.floor(Date.now() / 1000);
const token = (over: Partial<VerifiedToken> = {}): VerifiedToken =>
  ({ realm: 'citizens', subject: 'user-1', tenantId: null, locale: null, authTime: now, acr: '1', sessionId: 's-1', roles: [], ...over });

class FakeDirectory implements AccountDirectory {
  sessions = new Map<string, IdpSession[]>();
  creds = new Map<string, IdpCredential[]>();
  deleted: string[] = [];
  async listSessions(u: string) { return this.sessions.get(u) ?? []; }
  async deleteSession(id: string) { this.deleted.push(`session:${id}`); for (const [u, l] of this.sessions) this.sessions.set(u, l.filter((s) => s.id !== id)); }
  async listCredentials(u: string) { return this.creds.get(u) ?? []; }
  async deleteCredential(u: string, id: string) { this.deleted.push(`cred:${id}`); this.creds.set(u, (this.creds.get(u) ?? []).filter((c) => c.id !== id)); }
}
const cred = (id: string, type: string): IdpCredential => ({ id, type, label: null, createdAt: new Date(0) });
const session = (id: string): IdpSession => ({ id, ipAddress: '192.0.2.1', startedAt: new Date(0), lastAccessAt: new Date(0), clients: ['civora-web'] });

describe('account security: sessions and authenticators (P3-API3, P3-API4, P3-F2)', () => {
  const setup = () => {
    const dir = new FakeDirectory();
    const mirrored: AuthenticatorView[][] = [];
    const sec = new AccountSecurity({ citizens: dir, staff: dir }, async (_p, _r, items) => { mirrored.push(items); });
    return { dir, sec, mirrored };
  };

  it('who can still sign in: citizens need a passkey, or password + TOTP; staff need password + security key', () => {
    assert.equal(canSignIn('citizens', new Set(['webauthn-passwordless'])), true);
    assert.equal(canSignIn('citizens', new Set(['password', 'otp'])), true);
    assert.equal(canSignIn('citizens', new Set(['password'])), false);
    assert.equal(canSignIn('citizens', new Set(['otp'])), false);
    assert.equal(canSignIn('staff', new Set(['password', 'webauthn'])), true);
    assert.equal(canSignIn('staff', new Set(['password', 'otp'])), false);
  });

  it('lists authenticators without the password and refreshes the mirror', async () => {
    const { dir, sec, mirrored } = setup();
    dir.creds.set('user-1', [cred('p', 'password'), cred('o', 'otp'), cred('k', 'webauthn-passwordless')]);
    const list = await sec.listAuthenticators('person-1', token());
    assert.deepEqual(list.map((a) => a.kind), ['totp', 'passkey']);
    assert.deepEqual(mirrored.at(-1)!.map((a) => a.id), ['o', 'k']);
  });

  it('removes an authenticator when another way to sign in remains; refuses the last one', async () => {
    const { dir, sec } = setup();
    dir.creds.set('user-1', [cred('p', 'password'), cred('o', 'otp'), cred('k', 'webauthn-passwordless')]);
    assert.equal(await sec.removeAuthenticator('person-1', token(), 'k'), 'removed');
    assert.equal(await sec.removeAuthenticator('person-1', token(), 'o'), 'last-way-to-sign-in');
    assert.equal(await sec.removeAuthenticator('person-1', token(), 'p'), 'not-found', 'the password is not an authenticator');
    assert.deepEqual(dir.deleted, ['cred:k']);
  });

  it('an officer cannot remove their only security key; another person\'s credential is not found', async () => {
    const { dir, sec } = setup();
    dir.creds.set('officer', [cred('p', 'password'), cred('key', 'webauthn')]);
    dir.creds.set('someone-else', [cred('x', 'otp'), cred('y', 'webauthn-passwordless')]);
    const officer = token({ realm: 'staff', subject: 'officer', tenantId: '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b' });
    assert.equal(await sec.removeAuthenticator('person-2', officer, 'key'), 'last-way-to-sign-in');
    assert.equal(await sec.removeAuthenticator('person-2', officer, 'y'), 'not-found');
    assert.deepEqual(dir.deleted, []);
  });

  it('sessions: the current one is marked; only one\'s own sessions can be ended', async () => {
    const { dir, sec } = setup();
    dir.sessions.set('user-1', [session('s-1'), session('s-2')]);
    dir.sessions.set('someone-else', [session('s-9')]);
    const list = await sec.listSessions(token());
    assert.deepEqual(list.map((s) => [s.id, s.current]), [['s-1', true], ['s-2', false]]);
    assert.equal(await sec.removeSession(token(), 's-9'), 'not-found');
    assert.equal(await sec.removeSession(token(), 's-2'), 'removed');
    assert.deepEqual(dir.deleted, ['session:s-2']);
  });
});

describe('step-up (P3-A4, RFC 9470)', () => {
  it('needs a sign-in with credentials within max age; single sign-on reuse (acr 0) or no auth_time is not enough', () => {
    assert.equal(recentlyAuthenticated({ authTime: now - 60, acr: '1' }, 300), true);
    assert.equal(recentlyAuthenticated({ authTime: now - 400, acr: '1' }, 300), false);
    assert.equal(recentlyAuthenticated({ authTime: now - 10, acr: '0' }, 300), false);
    assert.equal(recentlyAuthenticated({ authTime: null, acr: '1' }, 300), false);
    assert.equal(recentlyAuthenticated({ authTime: now + 3600, acr: '1' }, 300), false, 'a sign-in time in the future is not trusted');
  });
  it('challenge and configuration', () => {
    assert.match(stepUpChallenge(300), /error="insufficient_user_authentication".*max_age=300/);
    assert.equal(loadStepUpMaxAge({}), 300);
    assert.throws(() => loadStepUpMaxAge({ STEP_UP_MAX_AGE_SECONDS: '5' }), /30\.\.3600/);
  });
});
