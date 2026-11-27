import { createHash } from 'node:crypto';
import { compactVerify, importJWK, type JWK } from 'jose';

/**
 * Compact JWS with a signer that never exposes its key (an HSM through PKCS#11, a device key, or a test key). Only the
 * algorithms of the HAIP profile are accepted (ES256); "none" and HMAC never.
 */
export const ALGORITHMS = ['ES256'] as const;
export type Alg = (typeof ALGORITHMS)[number];

export interface Signer {
  alg: Alg;
  /** JOSE header parameters that identify the key: kid, or x5c, or jwk (for holder proofs). */
  header: Record<string, unknown>;
  /** The raw signature over the signing input: for ES256, r || s (64 bytes), as JWS requires. */
  sign(signingInput: Uint8Array): Promise<Uint8Array>;
}

export const b64u = (b: Uint8Array | string): string => Buffer.from(typeof b === 'string' ? Buffer.from(b, 'utf8') : b).toString('base64url');
export const fromB64u = (s: string): Buffer => {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new CredentialError('malformed', 'not base64url');
  return Buffer.from(s, 'base64url');
};
export const sha256b64u = (s: string): string => createHash('sha256').update(s, 'ascii').digest('base64url');

export class CredentialError extends Error {
  constructor(readonly code: string, message: string) {
    super(`${code}: ${message}`);
  }
}

export async function signJws(signer: Signer, header: Record<string, unknown>, payload: Record<string, unknown>): Promise<string> {
  const h = b64u(JSON.stringify({ ...header, ...signer.header, alg: signer.alg }));
  const p = b64u(JSON.stringify(payload));
  const sig = await signer.sign(Buffer.from(`${h}.${p}`, 'ascii'));
  if (signer.alg === 'ES256' && sig.length !== 64) throw new CredentialError('signer', 'an ES256 signature is r || s, 64 bytes');
  return `${h}.${p}.${b64u(sig)}`;
}

/** Header and payload of a compact JWS, unverified (to find the key). */
export function peekJws(jws: string): { header: Record<string, unknown>; payload: Record<string, unknown> } {
  const parts = jws.split('.');
  if (parts.length !== 3) throw new CredentialError('malformed', 'not a compact JWS');
  try {
    const header = JSON.parse(fromB64u(parts[0]!).toString('utf8'));
    const payload = JSON.parse(fromB64u(parts[1]!).toString('utf8'));
    if (!header || typeof header !== 'object' || Array.isArray(header) || !payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('not objects');
    return { header, payload };
  } catch (e) {
    if (e instanceof CredentialError) throw e;
    throw new CredentialError('malformed', 'header or payload is not a JSON object');
  }
}

/** Verifies a compact JWS with a public JWK; the algorithm must be allowed and match the key. */
export async function verifyJws(jws: string, jwk: JWK, expectedTyp?: string): Promise<{ header: Record<string, unknown>; payload: Record<string, unknown> }> {
  const { header, payload } = peekJws(jws);
  if (!ALGORITHMS.includes(header.alg as Alg)) throw new CredentialError('alg', `algorithm ${String(header.alg)} not accepted`);
  if (expectedTyp !== undefined && header.typ !== expectedTyp) throw new CredentialError('typ', `typ must be ${expectedTyp}`);
  if (jwk.d) throw new CredentialError('key', 'a private key was given where a public key is expected');
  let key;
  try {
    key = await importJWK({ ...jwk, alg: header.alg as string }, header.alg as string);
  } catch {
    throw new CredentialError('key', 'unusable public key');
  }
  try {
    await compactVerify(jws, key, { algorithms: [...ALGORITHMS] });
  } catch {
    throw new CredentialError('signature', 'signature does not verify');
  }
  return { header, payload };
}
