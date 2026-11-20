import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import { Client } from 'pg';

/**
 * O-DB2 migration test. Runs only when TEST_DATABASE_URL points at a disposable database
 * (CI starts one; locally: infra/compose). Applies up, checks the schemas, rolls back, re-applies.
 */
const url = process.env.TEST_DATABASE_URL;
const root = resolve(__dirname, '..', '..');
const bin = resolve(root, 'node_modules', '.bin', 'node-pg-migrate');
const run = (direction: 'up' | 'down', count?: string) =>
  execFileSync(bin, [direction, ...(count ? [count] : []), '--migrations-dir', 'migrations', '--migration-file-language', 'sql', '--migrations-table', 'schema_migrations', '--check-order'], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });

describe('base schema migrations (O-DB1, O-DB2)', { skip: !url && 'TEST_DATABASE_URL not set' }, () => {
  it('applies, rolls back and re-applies cleanly', async () => {
    const schemas = async (): Promise<string[]> => {
      const c = new Client({ connectionString: url });
      await c.connect();
      const r = await c.query("select nspname from pg_namespace where nspname in ('iam','config','audit') order by nspname");
      await c.end();
      return r.rows.map((x) => x.nspname as string);
    };
    run('up');
    assert.deepEqual(await schemas(), ['audit', 'config', 'iam']);
    run('down', '1');
    assert.deepEqual(await schemas(), []);
    run('up');
    assert.deepEqual(await schemas(), ['audit', 'config', 'iam']);
  });
});
