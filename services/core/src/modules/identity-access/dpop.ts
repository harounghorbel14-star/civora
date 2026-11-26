import { createHash } from 'node:crypto';
import { calculateJwkThumbprint, decodeProtectedHeader, EmbeddedJWK, type JWK, jwtVerify } from 'jose';

/**
 * DPoP (RFC 9449; ASVS 5.0 V10.3.5): an access token bound to a key (`cnf.jkt`) is accepted only with a proof signed
 * by that key, made for this request (method and URL), fresh (iat within 60 s), used once (jti), and naming this very
 * token (ath). A stolen bound token is useless without the private key, which never leaves the client (the web app's
 * server, per session).
 */
export class DpopError extends Error {}

export interface DpopConfig {
  /** Base URLs the core is reached under (CORE_PUBLIC_URLS); empty: the request's own scheme and host (dev, test). */
  publicUrls: string[];
  /** Clients whose tokens must be bound (DPOP_REQUIRED_CLIENTS; default civora-web and civora-mobile): a Bearer token from them is refused. */
  requiredClients: Set<string>;
}

export function loadDpopConfig(env: NodeJS.ProcessEnv = process.env): DpopConfig {
  const publicUrls = (env.CORE_PUBLIC_URLS ?? '').split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean);
  for (const u of publicUrls) if (!/^https?:\/\/[^/]+$/.test(u)) throw new Error(`CORE_PUBLIC_URLS: ${u} is not a base URL`);
  const requiredClients = new Set((env.DPOP_REQUIRED_CLIENTS ?? 'civora-web,civora-mobile').split(',').map((s) => s.trim()).filter(Boolean));
  return { publicUrls, requiredClients };
}

const ALGORITHMS = ['ES256', 'ES384', 'PS256', 'RS256', 'EdDSA'];
const MAX_AGE_SECONDS = 60;
const b64sha256 = (s: string): string => createHash('sha256').update(s, 'ascii').digest('base64url');

export interface ProofCheck {
  proof: string;
  method: string;
  /** Every URL this request may have been sent to (the proof's htu must be one of them). */
  urls: string[];
  accessToken: string;
  jkt: string;
  /** Records the proof's identifier; false when it was seen before (replay). */
  claimJti(digest: Buffer, ttlSeconds: number): Promise<boolean>;
  now?: number;
}

export async function verifyDpopProof(c: ProofCheck): Promise<void> {
  if (!/^[A-Za-z0-9._-]{20,4096}$/.test(c.proof)) throw new DpopError('malformed proof');
  let header;
  try {
    header = decodeProtectedHeader(c.proof);
  } catch {
    throw new DpopError('malformed proof');
  }
  const jwk = header.jwk as JWK | undefined;
  if (!jwk || 'd' in jwk || 'p' in jwk || 'k' in jwk) throw new DpopError('the proof must carry a public key');
  let payload;
  try {
    ({ payload } = await jwtVerify(c.proof, EmbeddedJWK, { typ: 'dpop+jwt', algorithms: ALGORITHMS }));
  } catch {
    throw new DpopError('invalid proof signature');
  }
  if ((await calculateJwkThumbprint(jwk, 'sha256')) !== c.jkt) throw new DpopError('the proof key is not the key the token is bound to');
  if (payload.htm !== c.method) throw new DpopError('proof made for another method');
  const htu = typeof payload.htu === 'string' ? payload.htu.split(/[?#]/)[0] : '';
  if (!c.urls.includes(htu)) throw new DpopError('proof made for another URL');
  const now = Math.floor((c.now ?? Date.now()) / 1000);
  if (typeof payload.iat !== 'number' || Math.abs(now - payload.iat) > MAX_AGE_SECONDS) throw new DpopError('proof too old or from the future');
  if (payload.ath !== b64sha256(c.accessToken)) throw new DpopError('proof made for another token');
  if (typeof payload.jti !== 'string' || payload.jti.length < 8 || payload.jti.length > 256) throw new DpopError('proof without a valid identifier');
  const digest = createHash('sha256').update(`dpop\0${c.jkt}\0${payload.jti}`, 'utf8').digest();
  if (!(await c.claimJti(digest, 2 * MAX_AGE_SECONDS))) throw new DpopError('proof already used');
}
