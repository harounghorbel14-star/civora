import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { Client } from 'pg';

/**
 * Test kit for the wallet's end-to-end tests (not a test itself); named *.test.helper.ts so it is left out of the image (package "files") and is not run as a test: a fresh database migrated as the owner and used by
 * the application as civora_core_app, a SoftHSM token whose keys are made by the ceremony script, and the application
 * with test token issuers for both realms. Synthetic data only.
 */
export const PUBLIC = 'https://wallet.civora-cell.invalid';
export const CITIZENS = 'https://keycloak.test/realms/civora-citizens';
export const STAFF = 'https://keycloak.test/realms/civora-staff';
export const MODULE = ['/usr/lib/softhsm/libsofthsm2.so', '/usr/lib/x86_64-linux-gnu/softhsm/libsofthsm2.so'].find((p) => existsSync(p));
export const hsmInstalled = !!MODULE && spawnSync('softhsm2-util', ['--version']).status === 0 && spawnSync('pkcs11-tool', ['--help']).status !== null;
export const display = (en: string) => ({ ar: `${en} (ar)`, fr: `${en} (fr)`, en });

const coreRoot = resolve(__dirname, '..', '..', '..', '..');
const repoRoot = resolve(coreRoot, '..', '..');

export interface WalletCell {
  app: INestApplication;
  base: string;
  admin: Client;
  /** A citizen token, or a staff token with tenant_id (and roles). */
  sign(sub: string, staff?: { tenantId: string; roles?: string[] }): Promise<string>;
  /** Makes a key on the token by the ceremony script; returns its public JWK. */
  ceremony(keyId: string, kid: string): Record<string, string>;
  close(): Promise<void>;
}

export async function startWalletCell(adminUrl: string, register: (admin: Client, ceremony: WalletCell['ceremony']) => Promise<void>): Promise<WalletCell> {
  const dir = mkdtempSync(join(tmpdir(), 'wallet-cell-'));
  writeFileSync(join(dir, 'softhsm2.conf'), `directories.tokendir = ${dir}\nobjectstore.backend = file\nlog.level = ERROR\n`);
  const hsmEnv = { ...process.env, SOFTHSM2_CONF: join(dir, 'softhsm2.conf'), CIVORA_HSM_PIN: '16180339', CIVORA_HSM_SO_PIN: '14142135' };
  let first = true;
  const ceremony = (keyId: string, kid: string): Record<string, string> => {
    execFileSync(join(repoRoot, 'infra/scripts/issuer-key-ceremony.sh'), ['--module', MODULE!, '--token-label', 'civora-wallet', '--key-label', kid,
      '--key-id', keyId, '--kid', kid, '--out', join(dir, 'records'), '--operator', 'Test operator', '--witness', 'Test witness', ...(first ? ['--init-token'] : [])],
      { env: hsmEnv, stdio: 'pipe' });
    first = false;
    return JSON.parse(readFileSync(join(dir, 'records', `${kid}.ceremony.json`), 'utf8')).public_jwk;
  };

  const dbName = `wallet_cell_${Date.now()}_${process.pid}`;
  const root = new Client({ connectionString: adminUrl });
  await root.connect();
  await root.query(`create database ${dbName}`);
  // One fixed test-only password for every test file (they run in parallel and share this role).
  const appPw = 'test-only-civora-core-app';
  try { await root.query('create role civora_core_app login nobypassrls'); } catch { /* exists */ }
  await root.query(`alter role civora_core_app login nobypassrls password '${appPw}'`);
  await root.end();
  const u = new URL(adminUrl);
  u.pathname = `/${dbName}`;
  execFileSync(resolve(coreRoot, 'node_modules', '.bin', 'node-pg-migrate'),
    ['up', '--migrations-dir', 'migrations', '--migration-file-language', 'sql', '--migrations-table', 'schema_migrations', '--check-order'],
    { cwd: coreRoot, env: { ...process.env, DATABASE_URL: u.toString() }, stdio: 'pipe' });
  const admin = new Client({ connectionString: u.toString() });
  await admin.connect();
  await register(admin, ceremony);
  u.username = 'civora_core_app';
  u.password = appPw;

  const { publicKey, privateKey } = await generateKeyPair('ES256');
  const jwksDir = mkdtempSync(join(tmpdir(), 'jwks-'));
  writeFileSync(join(jwksDir, 'jwks.json'), JSON.stringify({ keys: [{ ...(await exportJWK(publicKey)), kid: 'e2e', alg: 'ES256', use: 'sig' }] }));
  const sign = (sub: string, staff?: { tenantId: string; roles?: string[] }) =>
    new SignJWT({ typ: 'Bearer', ...(staff ? { tenant_id: staff.tenantId, realm_access: { roles: staff.roles ?? [] } } : {}) })
      .setProtectedHeader({ alg: 'ES256', kid: 'e2e' }).setIssuer(staff ? STAFF : CITIZENS).setAudience('civora-core').setSubject(sub)
      .setIssuedAt().setExpirationTime('5m').sign(privateKey);
  Object.assign(process.env, {
    CIVORA_ENV: 'test', DATABASE_URL: u.toString(), OIDC_ISSUER_CITIZENS: CITIZENS, OIDC_ISSUER_STAFF: STAFF, OIDC_LOCAL_JWKS_FILE: join(jwksDir, 'jwks.json'),
    WALLET_PUBLIC_URL: PUBLIC, WALLET_HSM_MODULE: MODULE, SOFTHSM2_CONF: hsmEnv.SOFTHSM2_CONF, CIVORA_HSM_PIN: hsmEnv.CIVORA_HSM_PIN,
  });
  const { createApp } = await import('../../app.factory');
  const app = await createApp({ logger: process.env.E2E_LOG ? undefined : false });
  await app.listen(0, '127.0.0.1');
  const base = `http://127.0.0.1:${(app.getHttpServer().address() as { port: number }).port}`;
  return {
    app, base, admin, sign, ceremony,
    close: async () => {
      await app.close();
      await admin.end();
      const r = new Client({ connectionString: adminUrl });
      await r.connect();
      await r.query(`drop database if exists ${dbName} with (force)`);
      await r.end();
    },
  };
}

/** fetch for the holder library: the cell's public URL mapped to the test server. */
export const mappedFetch = (base: string) => async (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => {
  const r = await fetch(url.startsWith(PUBLIC) ? base + url.slice(PUBLIC.length) : url, init as RequestInit);
  return { status: r.status, text: () => r.text() };
};
