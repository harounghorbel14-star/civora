import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { loadProvisionerConfig, type CitizenDirectory, type DirectoryUser } from './keycloak-admin';
import { keycloakLocale, packLocale } from './locale';
import { emailDigest, normaliseEmail, RegistrationService } from './registration.service';

const SUPPORTED = ['ar-TN', 'fr-TN', 'en'];

describe('locales: Keycloak languages mapped onto the country pack', () => {
  it('maps ar/fr/en to the pack locales; unknown or missing falls back to the default', () => {
    assert.equal(packLocale('ar', SUPPORTED, 'ar-TN'), 'ar-TN');
    assert.equal(packLocale('fr', SUPPORTED, 'ar-TN'), 'fr-TN');
    assert.equal(packLocale('fr-FR', SUPPORTED, 'ar-TN'), 'fr-TN');
    assert.equal(packLocale('en', SUPPORTED, 'ar-TN'), 'en');
    assert.equal(packLocale('de', SUPPORTED, 'ar-TN'), 'ar-TN');
    assert.equal(packLocale(null, SUPPORTED, 'ar-TN'), 'ar-TN');
    assert.equal(keycloakLocale('ar-TN'), 'ar');
    assert.equal(keycloakLocale('en'), 'en');
  });
});

describe('registration without account enumeration', () => {
  class FakeDirectory implements CitizenDirectory {
    users = new Map<string, DirectoryUser & { locale: string }>();
    sent: string[] = [];
    failing = false;
    async findByEmail(email: string) {
      if (this.failing) throw new Error('Keycloak admin GET /users: HTTP 503');
      return this.users.get(email) ?? null;
    }
    async create(email: string, locale: string) {
      const id = `id-${this.users.size + 1}`;
      this.users.set(email, { id, hasCredentials: false, locale });
      return id;
    }
    async sendActivation(id: string) {
      this.sent.push(id);
    }
  }
  const setup = () => {
    const directory = new FakeDirectory();
    const permits = new Map<string, number>();
    const logs: Record<string, unknown>[] = [];
    const service = new RegistrationService({
      directory,
      permit: async (d) => {
        const k = d.toString('hex');
        const n = (permits.get(k) ?? 0) + 1;
        permits.set(k, n);
        return n === 1; // one send per address in this test window
      },
      log: (e) => logs.push(e),
    });
    return { directory, service, logs };
  };

  it('normalises addresses and refuses malformed ones', () => {
    assert.equal(normaliseEmail('  Citizen.Synthetic@Example.INVALID '), 'citizen.synthetic@example.invalid');
    for (const bad of ['', 'no-at', 'a@b', 'a@@b.tn', `${'x'.repeat(250)}@b.tn`, 42, null, 'a b@c.tn']) assert.equal(normaliseEmail(bad), null, String(bad));
  });

  it('new address: account created without credentials, activation link sent, in the requested language', async () => {
    const { directory, service } = setup();
    assert.equal(await service.process('new@example.invalid', 'fr'), 'created');
    const u = directory.users.get('new@example.invalid')!;
    assert.equal(u.hasCredentials, false);
    assert.equal(u.locale, 'fr');
    assert.deepEqual(directory.sent, [u.id]);
  });

  it('activated address: nothing is sent; pending address: the link is sent again', async () => {
    const { directory, service } = setup();
    directory.users.set('active@example.invalid', { id: 'a1', hasCredentials: true, locale: 'ar' });
    directory.users.set('pending@example.invalid', { id: 'p1', hasCredentials: false, locale: 'ar' });
    assert.equal(await service.process('active@example.invalid', 'ar'), 'already-active');
    assert.equal(await service.process('pending@example.invalid', 'ar'), 'resent');
    assert.deepEqual(directory.sent, ['p1']);
  });

  it('a second request for the same address within the interval sends nothing', async () => {
    const { directory, service } = setup();
    assert.equal(await service.process('twice@example.invalid', 'ar'), 'created');
    assert.equal(await service.process('twice@example.invalid', 'ar'), 'rate-limited');
    assert.equal(directory.sent.length, 1);
  });

  it('identity provider failure is logged without the address and does not throw', async () => {
    const { directory, service, logs } = setup();
    directory.failing = true;
    assert.equal(await service.process('down@example.invalid', 'ar'), 'failed');
    const text = JSON.stringify(logs);
    assert.ok(!text.includes('down@example.invalid'), 'address must not be logged');
    assert.ok(text.includes(emailDigest('down@example.invalid').toString('hex').slice(0, 8)));
  });

  it('submit() answers before the work runs (the HTTP answer cannot depend on the address)', async () => {
    const { directory, service } = setup();
    const pending = service.submit('later@example.invalid', 'ar');
    assert.equal(directory.users.size, 0, 'nothing looked up or created synchronously');
    assert.equal(await pending, 'created');
  });

  it('configuration: needs a secret and the citizens issuer; https outside dev/test; bounded lifespan', () => {
    assert.equal(loadProvisionerConfig({ CIVORA_ENV: 'dev' }), null);
    const c = loadProvisionerConfig({ CIVORA_ENV: 'dev', OIDC_ISSUER_CITIZENS: 'http://localhost:8080/realms/civora-citizens', KEYCLOAK_PROVISIONER_SECRET: 's' })!;
    assert.equal(c.realm, 'civora-citizens');
    assert.equal(c.baseUrl, 'http://localhost:8080');
    assert.throws(() => loadProvisionerConfig({ CIVORA_ENV: 'prod', OIDC_ISSUER_CITIZENS: 'https://kc/realms/c', KEYCLOAK_PROVISIONER_SECRET: 's', KEYCLOAK_INTERNAL_URL: 'http://keycloak:8080' }), /https/);
    assert.throws(() => loadProvisionerConfig({ CIVORA_ENV: 'dev', OIDC_ISSUER_CITIZENS: 'http://kc/realms/c', KEYCLOAK_PROVISIONER_SECRET: 's', ACTIVATION_LIFESPAN_SECONDS: '999999' }), /LIFESPAN/);
  });
});
