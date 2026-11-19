import { strict as assert } from 'node:assert';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { loadAppConfig } from './app-config';

describe('loadAppConfig', () => {
  it('prefers DATABASE_URL_FILE (secret volume) over DATABASE_URL', () => {
    const dir = mkdtempSync(join(tmpdir(), 'civora-cfg-'));
    const file = join(dir, 'database-url');
    writeFileSync(file, 'postgres://from-file@db/x\n');
    const cfg = loadAppConfig({ DATABASE_URL_FILE: file, DATABASE_URL: 'postgres://from-env@db/x' });
    assert.equal(cfg.databaseUrl, 'postgres://from-file@db/x');
  });
  it('rejects an unknown environment and an invalid port', () => {
    assert.throws(() => loadAppConfig({ CIVORA_ENV: 'production' }), /invalid CIVORA_ENV/);
    assert.throws(() => loadAppConfig({ PORT: '70000' }), /invalid PORT/);
  });
  it('defaults to the TN pack in dev with no database', () => {
    const cfg = loadAppConfig({});
    assert.deepEqual([cfg.countryPack, cfg.environment, cfg.databaseUrl], ['tn', 'dev', null]);
  });
});
