import { strict as assert } from 'node:assert';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, describe, it } from 'node:test';
import { CredentialError } from './jws';
import { softwareKey } from './keys';
import { pkcs11Signer } from './pkcs11';
import { present } from './sd-jwt';
import { issueCredential, verifyCredential } from './sd-jwt-vc';
import { signStatusList, STATUS, StatusList, statusFromToken } from './status-list';

/**
 * Issuer keys in SoftHSM 2 through PKCS#11 (P4-A5, P4-SEC3): the key ceremony script makes the key on a fresh token,
 * then credentials and status lists are signed by the token and verified with the public key from the ceremony record.
 * Needs SoftHSM 2 and OpenSC (Ubuntu packages softhsm2, opensc). CI installs them and sets CIVORA_HSM_TESTS=required,
 * so there a missing tool fails the test instead of skipping it.
 */
const MODULE = ['/usr/lib/softhsm/libsofthsm2.so', '/usr/lib/x86_64-linux-gnu/softhsm/libsofthsm2.so'].find((p) => existsSync(p));
const tools = !!MODULE && spawnSync('pkcs11-tool', ['--help']).status !== null && spawnSync('softhsm2-util', ['--version']).status === 0;
const required = process.env.CIVORA_HSM_TESTS === 'required';
const ceremony = resolve(__dirname, '../../../infra/scripts/issuer-key-ceremony.sh');

describe('issuer keys in SoftHSM through PKCS#11', { skip: !tools && !required ? 'SoftHSM 2 and OpenSC are not installed (CI requires them)' : false }, () => {
  it('the tools are present', () => assert.ok(tools, 'softhsm2 and opensc must be installed when CIVORA_HSM_TESTS=required'));
  if (!tools) return;

  const dir = mkdtempSync(join(tmpdir(), 'civora-hsm-'));
  after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, 'softhsm2.conf'), `directories.tokendir = ${dir}\nobjectstore.backend = file\nlog.level = ERROR\n`);
  const env = { ...process.env, SOFTHSM2_CONF: join(dir, 'softhsm2.conf'), CIVORA_HSM_PIN: '20261127', CIVORA_HSM_SO_PIN: '72116202' };
  const cfg = { module: MODULE!, tokenLabel: 'civora-issuers-test', keyId: '01', pinEnv: 'CIVORA_HSM_PIN', kid: 'demo-civil-registry-test-1', env };
  const runCeremony = (keyId: string, kid: string, init: boolean) => execFileSync(ceremony, [
    '--module', MODULE!, '--token-label', cfg.tokenLabel, '--key-label', kid, '--key-id', keyId, '--kid', kid, '--out', join(dir, 'records'),
    '--operator', 'Test operator', '--witness', 'Test witness', ...(init ? ['--init-token'] : []),
  ], { env, stdio: 'pipe' });

  it('the ceremony makes a sensitive, never-extractable P-256 key and records only its public half', () => {
    runCeremony('01', cfg.kid, true);
    const record = JSON.parse(readFileSync(join(dir, 'records', `${cfg.kid}.ceremony.json`), 'utf8'));
    assert.match(record.key.private_key_attributes, /never extractable/);
    assert.equal(record.public_jwk.crv, 'P-256');
    assert.equal(record.public_jwk.d, undefined);
    assert.equal(record.witnesses.length, 1);
    assert.ok(!JSON.stringify(record).includes(env.CIVORA_HSM_PIN), 'no PIN in the record');
    assert.throws(() => runCeremony('01', 'other', false), 'a ceremony never replaces a key (same id)');
  });

  it('a credential and a status list signed by the token verify with the public key of the ceremony record', async () => {
    const record = JSON.parse(readFileSync(join(dir, 'records', `${cfg.kid}.ceremony.json`), 'utf8'));
    const signer = await pkcs11Signer(cfg);
    assert.deepEqual({ x: signer.publicJwk.x, y: signer.publicJwk.y }, { x: record.public_jwk.x, y: record.public_jwk.y });
    const holder = softwareKey();
    const uri = 'https://wallet.civora-cell.invalid/v1/status-lists/1';
    const issued = await issueCredential(signer, {
      iss: 'https://wallet.civora-cell.invalid/issuers/demo-civil-registry', vct: 'urn:civora:tn:synthetic:residence-certificate:1',
      holderJwk: holder.publicJwk, exp: Math.floor(Date.now() / 1000) + 3600, status: { status_list: { idx: 2, uri } },
      claims: { given_name: 'Synthetic', locality: 'Gabes' }, selectivelyDisclosable: ['given_name', 'locality'],
    });
    const kb = { aud: 'https://verifier.example.invalid', nonce: 'hsm-test-nonce-0001' };
    const vp = await present(issued.sdJwt, issued.disclosures.filter((d) => d.path === 'locality').map((d) => d.encoded), holder, kb);
    const v = await verifyCredential(vp, { issuerKey: async () => record.public_jwk, keyBinding: kb });
    assert.equal(v.claims.locality, 'Gabes');
    const list = new StatusList(1, 64);
    list.set(2, STATUS.INVALID);
    const token = await signStatusList(signer, uri, list);
    assert.equal((await statusFromToken(token, record.public_jwk, uri, 2)).status, STATUS.INVALID);
  });

  it('a wrong PIN, an unknown key id or a missing PIN variable fails when the signer is made, not at the first credential', async () => {
    const bad = (e: unknown) => e instanceof CredentialError;
    await assert.rejects(pkcs11Signer({ ...cfg, env: { ...env, CIVORA_HSM_PIN: '00000000' } }), bad);
    await assert.rejects(pkcs11Signer({ ...cfg, keyId: '7f' }), bad);
    await assert.rejects(pkcs11Signer({ ...cfg, env: { ...env, CIVORA_HSM_PIN: '' } }), bad);
    await assert.rejects(pkcs11Signer({ ...cfg, pinEnv: 'lower-case; rm' }), bad);
  });
});
