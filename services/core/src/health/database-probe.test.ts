import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import type { AppConfig } from '../config/app-config';
import { DatabaseProbe } from './database-probe';

describe('DatabaseProbe', () => {
  it('survives an idle connection being terminated (database failover) instead of crashing the process', async () => {
    // No connection is opened: the pool only connects on the first query.
    const probe = new DatabaseProbe({ databaseUrl: 'postgres://u:p@127.0.0.1:1/none' } as AppConfig);
    const pool = (probe as unknown as { pool: import('pg').Pool }).pool;
    // What pg-pool emits when the server ends an idle client ("terminating connection due to administrator command").
    assert.doesNotThrow(() => pool.emit('error', new Error('terminating connection due to administrator command'), {}));
    await probe.onModuleDestroy();
  });

  it('reports down (not a crash) when the database is unreachable', async () => {
    const probe = new DatabaseProbe({ databaseUrl: 'postgres://u:p@127.0.0.1:1/none' } as AppConfig);
    assert.equal(await probe.check(), 'down');
    await probe.onModuleDestroy();
  });

  it('reports not-configured without a URL', async () => {
    const probe = new DatabaseProbe({} as AppConfig);
    assert.equal(await probe.check(), 'not-configured');
  });
});
