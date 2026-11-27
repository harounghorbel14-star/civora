import { randomBytes } from 'node:crypto';
import type { JWK } from 'jose';
import { b64u, CredentialError, fromB64u, peekJws, sha256b64u, type Signer, signJws, verifyJws } from './jws';

/**
 * Selective Disclosure for JWTs, RFC 9901 (November 2025): an issuer-signed JWT whose selectively disclosable claims
 * are replaced by digests of "disclosures" ([salt, name, value] for object properties, [salt, value] for array
 * elements); the holder presents only the disclosures it chooses, and binds the presentation to the verifier with a
 * key-binding JWT (typ kb+jwt: aud, nonce, iat, sd_hash). Only sha-256 is used.
 *
 * Paths are JSON-pointer-like: "address/street_address", "nationalities/1".
 */

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

export interface Disclosure {
  /** base64url of the JSON array, as it travels. */
  encoded: string;
  digest: string;
  path: string;
  name?: string;
  value: Json;
}

export interface Issued {
  /** issuer JWT ~ disclosure ~ … ~ (no key binding) */
  sdJwt: string;
  disclosures: Disclosure[];
}

const RESERVED = new Set(['_sd', '...', '_sd_alg']);

/** Trims leading and trailing "/" from a claim path: a loop, linear on any input (no backtracking regex). */
export function trimSlashes(p: string): string {
  let a = 0;
  let b = p.length;
  while (a < b && p.charCodeAt(a) === 47) a++;
  while (b > a && p.charCodeAt(b - 1) === 47) b--;
  return p.slice(a, b);
}
const salt = (): string => randomBytes(16).toString('base64url');
const isObject = (v: unknown): v is Record<string, Json> => !!v && typeof v === 'object' && !Array.isArray(v);

function makeDisclosure(path: string, value: Json, name?: string): Disclosure {
  const arr = name === undefined ? [salt(), value] : [salt(), name, value];
  const encoded = b64u(JSON.stringify(arr));
  return { encoded, digest: sha256b64u(encoded), path, name, value };
}

/**
 * Replaces the claims at `sdPaths` by digests (recursively: a disclosed object may itself hold disclosable claims).
 * `decoys` adds that many decoy digests to each object that has selectively disclosable claims (RFC 9901 §4.2.5),
 * so the number of claims is not revealed.
 */
export function pack(claims: Record<string, Json>, sdPaths: string[], decoys = 0): { payload: Record<string, Json>; disclosures: Disclosure[] } {
  const wanted = new Set(sdPaths.map((p) => trimSlashes(p)));
  const disclosures: Disclosure[] = [];
  const seen = new Set<string>();
  const walk = (value: Json, path: string): Json => {
    if (Array.isArray(value)) {
      return value.map((el, i) => {
        const p = path ? `${path}/${i}` : String(i);
        const inner = walk(el, p);
        if (!wanted.has(p)) return inner;
        seen.add(p);
        const d = makeDisclosure(p, inner);
        disclosures.push(d);
        return { '...': d.digest };
      });
    }
    if (isObject(value)) {
      const out: Record<string, Json> = {};
      const sd: string[] = [];
      for (const [k, v] of Object.entries(value)) {
        if (RESERVED.has(k)) throw new CredentialError('claims', `claim name ${k} is reserved`);
        const p = path ? `${path}/${k}` : k;
        const inner = walk(v, p);
        if (wanted.has(p)) {
          seen.add(p);
          const d = makeDisclosure(p, inner, k);
          disclosures.push(d);
          sd.push(d.digest);
        } else {
          out[k] = inner;
        }
      }
      if (sd.length) {
        for (let i = 0; i < decoys; i++) sd.push(sha256b64u(salt()));
        out._sd = sd.sort();
      }
      return out;
    }
    return value;
  };
  const payload = walk(claims, '') as Record<string, Json>;
  const missing = [...wanted].filter((p) => !seen.has(p));
  if (missing.length) throw new CredentialError('claims', `no claim at ${missing.join(', ')}`);
  return { payload, disclosures };
}

export async function issueSdJwt(signer: Signer, typ: string, claims: Record<string, Json>, sdPaths: string[], decoys = 0): Promise<Issued> {
  const { payload, disclosures } = pack(claims, sdPaths, decoys);
  const jwt = await signJws(signer, { typ }, { ...payload, _sd_alg: 'sha-256' });
  return { sdJwt: [jwt, ...disclosures.map((d) => d.encoded)].join('~') + '~', disclosures };
}

export interface Parsed {
  jwt: string;
  disclosures: string[];
  kbJwt: string | null;
  /** issuer JWT and disclosures, each followed by "~": the input of sd_hash */
  presented: string;
}

export function parse(compact: string): Parsed {
  if (typeof compact !== 'string' || !compact.includes('~')) throw new CredentialError('malformed', 'not an SD-JWT');
  const parts = compact.split('~');
  const jwt = parts[0]!;
  const kb = parts[parts.length - 1]!;
  const disclosures = parts.slice(1, -1);
  if (disclosures.some((d) => d === '')) throw new CredentialError('malformed', 'empty disclosure');
  const presented = [jwt, ...disclosures].join('~') + '~';
  return { jwt, disclosures, kbJwt: kb === '' ? null : kb, presented };
}

/**
 * The holder's view of its own credential: every disclosure with the claim path it opens, found by walking the
 * payload's digests (no signature check: the holder checked the credential when it received it). Disclosures that no
 * digest refers to are left out.
 */
export function disclosuresOf(sdJwt: string): Disclosure[] {
  const p = parse(sdJwt);
  const byDigest = new Map<string, { encoded: string; arr: Json[] }>();
  for (const encoded of p.disclosures) {
    try {
      const arr = JSON.parse(fromB64u(encoded).toString('utf8')) as Json[];
      if (Array.isArray(arr) && (arr.length === 2 || arr.length === 3)) byDigest.set(sha256b64u(encoded), { encoded, arr });
    } catch { /* not a disclosure: ignored */ }
  }
  const out: Disclosure[] = [];
  const walk = (v: unknown, path: string): void => {
    if (Array.isArray(v)) {
      v.forEach((el, i) => {
        const p2 = `${path}/${i}`;
        if (isObject(el) && Object.keys(el).length === 1 && typeof el['...'] === 'string') {
          const d = byDigest.get(el['...']);
          if (d && d.arr.length === 2) {
            out.push({ encoded: d.encoded, digest: el['...'], path: p2, value: d.arr[1]! });
            walk(d.arr[1], p2);
          }
        } else walk(el, p2);
      });
      return;
    }
    if (!isObject(v)) return;
    for (const [k, x] of Object.entries(v)) if (k !== '_sd' && k !== '_sd_alg') walk(x, path ? `${path}/${k}` : k);
    for (const raw of Array.isArray(v._sd) ? v._sd : []) {
      const d = typeof raw === 'string' ? byDigest.get(raw) : undefined;
      if (!d || d.arr.length !== 3 || typeof d.arr[1] !== 'string') continue;
      const p2 = path ? `${path}/${d.arr[1]}` : d.arr[1];
      out.push({ encoded: d.encoded, digest: raw as string, path: p2, name: d.arr[1], value: d.arr[2]! });
      walk(d.arr[2], p2);
    }
  };
  walk(peekJws(p.jwt).payload, '');
  return out;
}

/** Which disclosures to present for the wanted paths: each wanted claim and every disclosure it is nested in. */
export function selectDisclosures(issued: Pick<Issued, 'disclosures'>, paths: string[]): Disclosure[] {
  const want = paths.map((p) => trimSlashes(p));
  return issued.disclosures.filter((d) => want.some((w) => w === d.path || w.startsWith(`${d.path}/`) || d.path.startsWith(`${w}/`)));
}

/** A presentation: the chosen disclosures, and a key-binding JWT signed with the holder's key (RFC 9901 §4.3). */
export async function present(sdJwt: string, chosen: string[], holder: Signer | null, kb?: { aud: string; nonce: string; iat?: number }): Promise<string> {
  const p = parse(sdJwt);
  for (const c of chosen) if (!p.disclosures.includes(c)) throw new CredentialError('present', 'a disclosure that is not part of the credential');
  const presented = [p.jwt, ...chosen].join('~') + '~';
  if (!holder) return presented;
  if (!kb) throw new CredentialError('present', 'key binding needs aud and nonce');
  const kbJwt = await signJws(holder, { typ: 'kb+jwt' }, {
    iat: kb.iat ?? Math.floor(Date.now() / 1000), aud: kb.aud, nonce: kb.nonce, sd_hash: sha256b64u(presented),
  });
  return presented + kbJwt;
}

export interface VerifyOptions {
  /** The issuer's public key for this JWT (the caller checks the issuer is trusted). */
  issuerKey: (header: Record<string, unknown>, payload: Record<string, unknown>) => Promise<JWK>;
  typ: string;
  /** Key binding required, with this audience and nonce (replay protection). */
  keyBinding?: { aud: string; nonce: string; maxAgeSeconds?: number };
  now?: number;
  clockSkewSeconds?: number;
}

export interface Verified {
  header: Record<string, unknown>;
  /** The issuer-signed claims with every presented disclosure applied; undisclosed claims are absent. */
  claims: Record<string, unknown>;
  disclosedPaths: string[];
}

/** Verifies an SD-JWT (and its key binding) per RFC 9901 §7; throws CredentialError on any defect. */
export async function verifySdJwt(compact: string, opts: VerifyOptions): Promise<Verified> {
  const p = parse(compact);
  const peek = peekJws(p.jwt);
  const { header, payload } = await verifyJws(p.jwt, await opts.issuerKey(peek.header, peek.payload), opts.typ);
  if (payload._sd_alg !== undefined && payload._sd_alg !== 'sha-256') throw new CredentialError('sd_alg', 'only sha-256 is accepted');

  // Disclosures by digest; each at most once.
  const byDigest = new Map<string, Json[]>();
  for (const enc of p.disclosures) {
    const digest = sha256b64u(enc);
    if (byDigest.has(digest)) throw new CredentialError('disclosure', 'the same disclosure twice');
    let arr: unknown;
    try {
      arr = JSON.parse(fromB64u(enc).toString('utf8'));
    } catch {
      throw new CredentialError('disclosure', 'not a JSON array');
    }
    if (!Array.isArray(arr) || (arr.length !== 2 && arr.length !== 3) || typeof arr[0] !== 'string') throw new CredentialError('disclosure', 'not [salt, (name,) value]');
    if (arr.length === 3 && (typeof arr[1] !== 'string' || RESERVED.has(arr[1]))) throw new CredentialError('disclosure', 'invalid claim name');
    byDigest.set(digest, arr as Json[]);
  }

  const used = new Set<string>();
  const digestsSeen = new Set<string>();
  const disclosedPaths: string[] = [];
  const claimDigest = (d: unknown): string => {
    if (typeof d !== 'string') throw new CredentialError('digest', 'a digest is not a string');
    if (digestsSeen.has(d)) throw new CredentialError('digest', 'a digest appears twice');
    digestsSeen.add(d);
    return d;
  };
  const walk = (value: unknown, path: string): unknown => {
    if (Array.isArray(value)) {
      const out: unknown[] = [];
      value.forEach((el) => {
        if (isObject(el) && Object.keys(el).length === 1 && '...' in el) {
          const d = claimDigest(el['...']);
          const disc = byDigest.get(d);
          if (!disc) return; // undisclosed array element (or decoy): left out
          if (disc.length !== 2) throw new CredentialError('disclosure', 'an array element disclosure has two elements');
          used.add(d);
          const p2 = `${path}/${out.length}`;
          disclosedPaths.push(p2);
          out.push(walk(disc[1], p2));
        } else {
          out.push(walk(el, `${path}/${out.length}`));
        }
      });
      return out;
    }
    if (isObject(value)) {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        if (k === '_sd' || k === '_sd_alg') continue;
        if (k === '...') throw new CredentialError('claims', '"..." outside an array element');
        out[k] = walk(v, path ? `${path}/${k}` : k);
      }
      if (value._sd !== undefined) {
        if (!Array.isArray(value._sd)) throw new CredentialError('digest', '_sd is not an array');
        for (const raw of value._sd) {
          const d = claimDigest(raw);
          const disc = byDigest.get(d);
          if (!disc) continue; // undisclosed claim or decoy
          if (disc.length !== 3) throw new CredentialError('disclosure', 'a property disclosure has three elements');
          const name = disc[1] as string;
          if (name in out) throw new CredentialError('claims', `claim ${name} disclosed and also in clear`);
          used.add(d);
          const p2 = path ? `${path}/${name}` : name;
          disclosedPaths.push(p2);
          out[name] = walk(disc[2], p2);
        }
      }
      return out;
    }
    return value;
  };
  const claims = walk(payload, '') as Record<string, unknown>;
  if (used.size !== byDigest.size) throw new CredentialError('disclosure', 'a disclosure is not referenced by the credential');

  const now = opts.now ?? Math.floor(Date.now() / 1000);
  const skew = opts.clockSkewSeconds ?? 60;
  if (typeof claims.exp === 'number' && now > claims.exp + skew) throw new CredentialError('expired', 'the credential has expired');
  if (typeof claims.nbf === 'number' && now + skew < claims.nbf) throw new CredentialError('not-yet-valid', 'the credential is not valid yet');
  if (claims.exp !== undefined && typeof claims.exp !== 'number') throw new CredentialError('claims', 'exp is not a number');

  if (opts.keyBinding) {
    if (!p.kbJwt) throw new CredentialError('key-binding', 'key binding JWT missing');
    const cnf = claims.cnf as { jwk?: JWK } | undefined;
    if (!cnf?.jwk) throw new CredentialError('key-binding', 'the credential has no holder key (cnf.jwk)');
    const kb = await verifyJws(p.kbJwt, cnf.jwk, 'kb+jwt');
    if (kb.payload.aud !== opts.keyBinding.aud) throw new CredentialError('key-binding', 'wrong audience');
    if (kb.payload.nonce !== opts.keyBinding.nonce) throw new CredentialError('key-binding', 'wrong nonce');
    const iat = kb.payload.iat;
    if (typeof iat !== 'number' || iat > now + skew || now - iat > (opts.keyBinding.maxAgeSeconds ?? 300)) throw new CredentialError('key-binding', 'iat out of range');
    if (kb.payload.sd_hash !== sha256b64u(p.presented)) throw new CredentialError('key-binding', 'sd_hash does not match the presentation');
  } else if (p.kbJwt) {
    throw new CredentialError('key-binding', 'unexpected key binding JWT');
  }
  return { header, claims, disclosedPaths };
}
