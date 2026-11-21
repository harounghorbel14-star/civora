import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { cleanupUnactivated } from '../modules/identity-access/public-api';
import { minutesFrom } from './cleanup-unactivated';

describe('cleanup of accounts never activated (R-P3-8)', () => {
  const now = Date.UTC(2026, 10, 21, 12);
  const hour = 3_600_000;
  const fake = (users: { id: string; createdTimestamp: number; emailVerified: boolean; creds: number }[]) => {
    const deleted: string[] = [];
    return {
      deleted,
      admin: {
        async json<T>(_m: string, path: string): Promise<T> {
          if (path.startsWith('/users?')) return (path.includes('first=0') ? users.map(({ id, createdTimestamp, emailVerified }) => ({ id, createdTimestamp, emailVerified })) : []) as T;
          const id = path.split('/')[2];
          return Array.from({ length: users.find((u) => u.id === id)!.creds }) as T;
        },
        async call(_m: string, path: string) { deleted.push(path.split('/')[2]!); },
      },
    };
  };

  it('removes only unverified accounts without any credential older than the limit', async () => {
    const { admin, deleted } = fake([
      { id: 'old-pending', createdTimestamp: now - 30 * hour, emailVerified: false, creds: 0 },
      { id: 'young-pending', createdTimestamp: now - 2 * hour, emailVerified: false, creds: 0 },
      { id: 'old-with-otp', createdTimestamp: now - 30 * hour, emailVerified: false, creds: 1 },
      { id: 'old-verified', createdTimestamp: now - 30 * hour, emailVerified: true, creds: 0 },
    ]);
    const r = await cleanupUnactivated(admin, 24 * 60, now);
    assert.deepEqual(deleted, ['old-pending']);
    assert.deepEqual(r, { scanned: 4, removed: 1 });
  });

  it('limits: at least an hour outside dev and test', () => {
    assert.equal(minutesFrom({ CIVORA_ENV: 'prod' }, 'X', 1440), 1440);
    assert.throws(() => minutesFrom({ CIVORA_ENV: 'prod', X: '5' }, 'X', 1440), /60\.\.525600/);
    assert.equal(minutesFrom({ CIVORA_ENV: 'test', X: '0' }, 'X', 1440), 0);
  });
});
