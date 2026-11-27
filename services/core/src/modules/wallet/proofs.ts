import { createHash } from 'node:crypto';
import { calculateJwkThumbprint, decodeProtectedHeader, EmbeddedJWK, type JWK, type JWTPayload, jwtVerify } from 'jose';

/**
 * Proofs the wallet endpoints accept (P4-SEC1 holder binding, P4-SEC2 replay):
 * - DPoP proofs (RFC 9449) at the token endpoint (no access token yet: the proof's key is the one the token will be
 *   bound to) and at the credential endpoint (with `ath`, by the key the token is bound to);
 * - OpenID4VCI 1.0 key proofs (`openid4vci-proof+jwt`, appendix F.1): the holder's public key in `jwk`, signed by it,
 *   for this issuer (`aud`), with a fresh `iat` and a `c_nonce` from the nonce endpoint.
 * ES256 only (HAIP 1.0). Replay storage is the caller's (single-use identifiers and nonces in the database).
 */
export class ProofError extends Error {
  constructor(readonly code: 'invalid_dpop_proof' | 'invalid_proof' | 'invalid_nonce', message: string) {
    super(message);
  }
}

const MAX_SKEW = 60;
const sha256b64u = (s: string): string => createHash('sha256').update(s, 'ascii').digest('base64url');

async function verifyWithEmbeddedKey(jwt: string, typ: string, code: ProofError['code']): Promise<{ payload: JWTPayload; jwk: JWK; jkt: string }> {
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(jwt) || jwt.length > 8192) throw new ProofError(code, 'malformed proof');
  let jwk: JWK | undefined;
  try {
    const h = decodeProtectedHeader(jwt);
    jwk = h.jwk as JWK | undefined;
    if (h.alg !== 'ES256') throw new Error();
  } catch {
    throw new ProofError(code, 'malformed proof header');
  }
  if (!jwk || jwk.kty !== 'EC' || jwk.crv !== 'P-256' || 'd' in jwk) throw new ProofError(code, 'the proof must carry a public P-256 key');
  try {
    const { payload } = await jwtVerify(jwt, EmbeddedJWK, { typ, algorithms: ['ES256'] });
    const pub: JWK = { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y };
    return { payload, jwk: pub, jkt: await calculateJwkThumbprint(pub, 'sha256') };
  } catch {
    throw new ProofError(code, 'invalid proof signature or type');
  }
}

const fresh = (iat: unknown, now: number): boolean => typeof iat === 'number' && Math.abs(now - iat) <= MAX_SKEW;

export interface DpopCheck {
  proof: string | undefined;
  method: string;
  /** The URL the request was made to, without query (the proof's htu must match it). */
  url: string;
  /** At the credential endpoint: the access token and the key it is bound to. */
  accessToken?: string;
  jkt?: string;
  claimJti(digest: Buffer, ttlSeconds: number): Promise<boolean>;
  now?: number;
}

/** Returns the thumbprint of the proof's key. */
export async function verifyDpop(c: DpopCheck): Promise<string> {
  if (typeof c.proof !== 'string') throw new ProofError('invalid_dpop_proof', 'a DPoP proof is required');
  const { payload, jkt } = await verifyWithEmbeddedKey(c.proof, 'dpop+jwt', 'invalid_dpop_proof');
  const now = c.now ?? Math.floor(Date.now() / 1000);
  if (payload.htm !== c.method) throw new ProofError('invalid_dpop_proof', 'proof made for another method');
  if (typeof payload.htu !== 'string' || payload.htu.split(/[?#]/)[0] !== c.url) throw new ProofError('invalid_dpop_proof', 'proof made for another URL');
  if (!fresh(payload.iat, now)) throw new ProofError('invalid_dpop_proof', 'proof too old or from the future');
  if (c.jkt !== undefined && jkt !== c.jkt) throw new ProofError('invalid_dpop_proof', 'the proof key is not the key the token is bound to');
  if (c.accessToken !== undefined ? payload.ath !== sha256b64u(c.accessToken) : payload.ath !== undefined) {
    throw new ProofError('invalid_dpop_proof', 'proof made for another token');
  }
  if (typeof payload.jti !== 'string' || payload.jti.length < 8 || payload.jti.length > 256) throw new ProofError('invalid_dpop_proof', 'proof without a valid identifier');
  const digest = createHash('sha256').update(`wallet-dpop\0${jkt}\0${payload.jti}`, 'utf8').digest();
  if (!(await c.claimJti(digest, 2 * MAX_SKEW))) throw new ProofError('invalid_dpop_proof', 'proof already used');
  return jkt;
}

export interface KeyProofCheck {
  proof: string;
  /** The credential issuer identifier (the proof's audience). */
  issuer: string;
  /** Marks the proof's c_nonce used; false when it is unknown, expired or used. */
  useNonce(nonce: string): Promise<boolean>;
  now?: number;
}

/** Returns the holder's public key and its RFC 7638 thumbprint. */
export async function verifyKeyProof(c: KeyProofCheck): Promise<{ jwk: JWK; jkt: string }> {
  const { payload, jwk, jkt } = await verifyWithEmbeddedKey(c.proof, 'openid4vci-proof+jwt', 'invalid_proof');
  const now = c.now ?? Math.floor(Date.now() / 1000);
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(c.issuer)) throw new ProofError('invalid_proof', 'the proof is for another issuer');
  if (!fresh(payload.iat, now)) throw new ProofError('invalid_proof', 'proof too old or from the future');
  if (typeof payload.nonce !== 'string' || !(await c.useNonce(payload.nonce))) throw new ProofError('invalid_nonce', 'the proof must carry a fresh c_nonce');
  return { jwk, jkt };
}
