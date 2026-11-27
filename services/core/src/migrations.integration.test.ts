import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
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
    run('down', String(readdirSync(resolve(root, 'migrations')).filter((f) => f.endsWith('.sql')).length));
    assert.deepEqual(await schemas(), []);
    run('up');
    assert.deepEqual(await schemas(), ['audit', 'config', 'iam']);
  });

  it('the public catalogue migrations (pg-public, Phase 5) apply, roll back and re-apply on their own table', async () => {
    const runPublic = (direction: 'up' | 'down', count?: string) =>
      execFileSync(bin, [direction, ...(count ? [count] : []), '--migrations-dir', 'migrations-public', '--migration-file-language', 'sql', '--migrations-table', 'schema_migrations_public', '--check-order'],
        { cwd: root, env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
    const has = async (): Promise<boolean> => {
      const c = new Client({ connectionString: url });
      await c.connect();
      const r = await c.query("select 1 from pg_namespace where nspname = 'catalogue'");
      await c.end();
      return r.rowCount === 1;
    };
    runPublic('up');
    assert.equal(await has(), true);
    runPublic('down', String(readdirSync(resolve(root, 'migrations-public')).filter((f) => f.endsWith('.sql')).length));
    assert.equal(await has(), false);
    runPublic('up');
    assert.equal(await has(), true);
  });
});
