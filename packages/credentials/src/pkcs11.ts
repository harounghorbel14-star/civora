import { spawn } from 'node:child_process';
import { createHash, createPublicKey, randomBytes, verify } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { JWK } from 'jose';
import { CredentialError, type Signer } from './jws';

/**
 * Issuer keys in an HSM through PKCS#11 (P4-A5; SoftHSM 2 in dev and test, ADR-028). The private key never leaves the
 * token: it is generated there as sensitive and never extractable (the key ceremony, doc phase-4/02), and this signer
 * only asks the token for signatures. The PKCS#11 calls go through OpenSC's pkcs11-tool, so no native module is
 * loaded into the service (ADR-027). The user PIN is read by pkcs11-tool from an environment variable named here, so it
 * never appears on a command line.
 *
 * ES256 only: the SHA-256 digest is computed here and the token signs it with CKM_ECDSA (SoftHSM 2.6 has no
 * CKM_ECDSA_SHA256); PKCS#11 returns r || s, which is what JWS needs.
 */
export interface Pkcs11KeyConfig {
  /** The PKCS#11 module, e.g. /usr/lib/softhsm/libsofthsm2.so. */
  module: string;
  tokenLabel: string;
  /** CKA_ID of the key pair, in hex (as given at the ceremony). */
  keyId: string;
  /** Name of the environment variable that holds the user PIN (not the PIN). */
  pinEnv: string;
  /** The `kid` published with the issuer's public key. */
  kid: string;
  /** OpenSC's pkcs11-tool (default: from the PATH). */
  tool?: string;
  /** Environment of the tool: PATH, the PIN variable, SOFTHSM2_CONF for SoftHSM. Default: this process's. */
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
}

export interface Pkcs11Signer extends Signer {
  publicJwk: JWK;
}

/**
 * Runs pkcs11-tool with its input and output in a private temporary directory (the tool opens files by name, and
 * Node's stdio pipes are sockets it cannot open as /dev/stdin or /dev/stdout). Only digests, signatures and public
 * keys pass through it.
 */
async function run(cfg: Pkcs11KeyConfig, args: string[], input?: Uint8Array): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), 'civora-p11-'));
  try {
    const inFile = join(dir, 'in');
    const outFile = join(dir, 'out');
    if (input) await writeFile(inFile, input, { mode: 0o600 });
    const fullArgs = ['--module', cfg.module, '--token-label', cfg.tokenLabel, ...args.map((a) => (a === '@in' ? inFile : a === '@out' ? outFile : a))];
    await new Promise<void>((resolve, reject) => {
      const child = spawn(cfg.tool ?? 'pkcs11-tool', fullArgs, { env: cfg.env ?? process.env, stdio: ['ignore', 'ignore', 'pipe'], timeout: cfg.timeoutMs ?? 10_000 });
      let err = '';
      child.stderr.on('data', (c: Buffer) => { if (err.length < 2000) err += c.toString('utf8'); });
      child.on('error', (e) => reject(new CredentialError('signer', `pkcs11-tool could not start: ${e.message}`)));
      child.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new CredentialError('signer', `PKCS#11 call failed (exit ${code}): ${err.split('\n').filter((l) => /error|fail|CKR_/i.test(l)).join(' ').slice(0, 300)}`));
      });
    });
    return await readFile(outFile);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** The public half of the key pair, as a JWK (P-256 only). */
export async function pkcs11PublicJwk(cfg: Pkcs11KeyConfig): Promise<JWK> {
  if (!/^[0-9a-f]{2,64}$/i.test(cfg.keyId)) throw new CredentialError('key', 'keyId must be hex');
  const der = await run(cfg, ['--read-object', '--type', 'pubkey', '--id', cfg.keyId, '--output-file', '@out']);
  let jwk: JWK;
  try {
    jwk = createPublicKey({ key: der, format: 'der', type: 'spki' }).export({ format: 'jwk' }) as JWK;
  } catch {
    throw new CredentialError('key', 'the token returned no usable public key for this id');
  }
  if (jwk.kty !== 'EC' || jwk.crv !== 'P-256') throw new CredentialError('key', 'issuer keys are P-256 (ES256)');
  return { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y };
}

/**
 * A Signer backed by the token. On creation it reads the public key and checks, with a fresh challenge, that the
 * token's signature verifies under it (a wrong id, PIN or token fails here, not at the first credential).
 */
export async function pkcs11Signer(cfg: Pkcs11KeyConfig): Promise<Pkcs11Signer> {
  if (!/^[A-Z_][A-Z0-9_]*$/.test(cfg.pinEnv)) throw new CredentialError('key', 'pinEnv is the name of an environment variable');
  if (!(cfg.env ?? process.env)[cfg.pinEnv]) throw new CredentialError('key', `the PIN variable ${cfg.pinEnv} is not set`);
  const publicJwk = await pkcs11PublicJwk(cfg);
  const sign = async (input: Uint8Array): Promise<Uint8Array> => {
    const digest = createHash('sha256').update(input).digest();
    const sig = await run(cfg, ['--login', '--pin', `env:${cfg.pinEnv}`, '--sign', '--mechanism', 'ECDSA', '--id', cfg.keyId,
      '--input-file', '@in', '--output-file', '@out'], digest);
    if (sig.length !== 64) throw new CredentialError('signer', 'the token did not return an r || s P-256 signature');
    return sig;
  };
  const challenge = randomBytes(32);
  const key = createPublicKey({ key: publicJwk as never, format: 'jwk' });
  if (!verify('sha256', challenge, { key, dsaEncoding: 'ieee-p1363' }, await sign(challenge))) {
    throw new CredentialError('signer', 'the token signature does not verify under its own public key');
  }
  return { alg: 'ES256', header: { kid: cfg.kid }, publicJwk, sign };
}
