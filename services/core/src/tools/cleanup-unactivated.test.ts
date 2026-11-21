import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { cleanupUnactivated } from '../modules/identity-access/public-api';
import { minutesFrom } from './cleanup-unactivated';

describe('cleanup of accounts never activated (R-P3-8)', () => {
  const now = Date.UTC(2026, 10, 21, 12);
  const hour = 3_600_000;
  type U = { id: string; createdTimestamp: number; emailVerified: boolean; creds: number; email?: string; username?: string; serviceAccountClientId?: string };
  const fake = (users: U[]) => {
    const deleted: string[] = [];
    return {
      deleted,
      admin: {
        async json<T>(_m: string, path: string): Promise<T> {
          const brief = ({ id, createdTimestamp, emailVerified, email, username }: U) => ({ id, createdTimestamp, emailVerified, email, username });
          if (path.startsWith('/users?')) return (path.includes('first=0') ? users.map(brief) : []) as T;
          const [, , id, sub] = path.split('/');
          const u = users.find((x) => x.id === id)!;
          if (!sub) return { ...brief(u), serviceAccountClientId: u.serviceAccountClientId } as T; // full record
          return Array.from({ length: u.creds }) as T;
        },
        async call(_m: string, path: string) { deleted.push(path.split('/')[2]!); },
      },
    };
  };

  it('removes only unverified accounts without any credential older than the limit', async () => {
    const old = now - 30 * hour;
    const { admin, deleted } = fake([
      { id: 'old-pending', createdTimestamp: old, emailVerified: false, creds: 0, email: 'a@example.invalid', username: 'a@example.invalid' },
      { id: 'young-pending', createdTimestamp: now - 2 * hour, emailVerified: false, creds: 0, email: 'b@example.invalid' },
      { id: 'old-with-otp', createdTimestamp: old, emailVerified: false, creds: 1, email: 'c@example.invalid' },
      { id: 'old-verified', createdTimestamp: old, emailVerified: true, creds: 0, email: 'd@example.invalid' },
      // Keycloak service accounts: no e-mail, no credential, never verified. Removing one breaks the client.
      { id: 'provisioner', createdTimestamp: old, emailVerified: false, creds: 0, username: 'service-account-civora-core-provisioner' },
      { id: 'linked-sa', createdTimestamp: old, emailVerified: false, creds: 0, email: 'sa@example.invalid', username: 'x', serviceAccountClientId: 'client-1' },
      { id: 'no-email', createdTimestamp: old, emailVerified: false, creds: 0, username: 'someone' },
    ]);
    const r = await cleanupUnactivated(admin, 24 * 60, now);
    assert.deepEqual(deleted, ['old-pending']);
    assert.deepEqual(r, { scanned: 7, removed: 1 });
  });

  it('limits: at least an hour outside dev and test', () => {
    assert.equal(minutesFrom({ CIVORA_ENV: 'prod' }, 'X', 1440), 1440);
    assert.throws(() => minutesFrom({ CIVORA_ENV: 'prod', X: '5' }, 'X', 1440), /60\.\.525600/);
    assert.equal(minutesFrom({ CIVORA_ENV: 'test', X: '0' }, 'X', 1440), 0);
  });
});
