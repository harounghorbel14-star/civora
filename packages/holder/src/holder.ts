import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { b64u, CredentialError, disclosuresOf, parse, peekJws, present, selectDisclosures, type Signer, softwareKey, statusFromToken, verifyCredential, type VerifiedCredential, verifyJws } from '@civora/credentials';
import type { JWK } from 'jose';

/**
 * The holder wallet (P4-D2), platform-neutral: the mobile app supplies a key store backed by the device's secure
 * hardware and a credential store backed by its encrypted storage; tests use the in-memory ones below.
 *
 * - Offers (P4-F1): `openid-credential-offer://` URIs by value; only the pre-authorised code grant with a transaction
 *   code; the issuer must be https.
 * - Issuance: issuer and authorization-server metadata, a DPoP-bound token, a c_nonce, a key proof by a NEW device key
 *   per credential (P4-SEC1; one key per credential, so two credentials cannot be linked by their cnf), then the
 *   credential is checked before it is kept: the issuer's signature (keys from its JWT VC issuer metadata), the type
 *   asked for, and that cnf is the device key.
 * - Presentation (P4-F2): only the claims the person chose, with a key-binding JWT for the verifier's audience and nonce.
 * - Backup (P4-DB3): AES-256-GCM under a key that stays on the device; the cell stores only the ciphertext and the
 *   key's identifier.
 */
export type Fetch = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{ status: number; text(): Promise<string> }>;

export interface DeviceKey extends Signer {
  publicJwk: JWK;
}

export interface KeyStore {
  /** A new P-256 key that never leaves the device (secure hardware in the app). */
  create(): Promise<{ ref: string; key: DeviceKey }>;
  get(ref: string): Promise<DeviceKey>;
  remove(ref: string): Promise<void>;
}

export interface HeldCredential {
  id: string;
  sdJwt: string;
  keyRef: string;
  vct: string;
  issuer: string;
  issuedAt: number;
  expiresAt: number;
  status?: { uri: string; idx: number };
  /** Display names of the type from the issuer metadata, by locale. */
  display: Record<string, string>;
}

export interface CredentialStore {
  put(c: HeldCredential): Promise<void>;
  get(id: string): Promise<HeldCredential | undefined>;
  list(): Promise<HeldCredential[]>;
  remove(id: string): Promise<void>;
}

export class MemoryKeyStore implements KeyStore {
  private readonly keys = new Map<string, DeviceKey>();
  async create() {
    const ref = randomUUID();
    const k = softwareKey();
    this.keys.set(ref, k);
    return { ref, key: k };
  }
  async get(ref: string) {
    const k = this.keys.get(ref);
    if (!k) throw new CredentialError('key', 'no such device key');
    return k;
  }
  async remove(ref: string) { this.keys.delete(ref); }
}

export class MemoryCredentialStore implements CredentialStore {
  private readonly items = new Map<string, HeldCredential>();
  async put(c: HeldCredential) { this.items.set(c.id, c); }
  async get(id: string) { return this.items.get(id); }
  async list() { return [...this.items.values()]; }
  async remove(id: string) { this.items.delete(id); }
}

export const PRE_AUTH_GRANT = 'urn:ietf:params:oauth:grant-type:pre-authorized_code';

export interface CredentialOffer {
  issuer: string;
  configurationIds: string[];
  preAuthorizedCode: string;
  txCode?: { length?: number; inputMode?: string };
}

/** Parses an offer URI (by value). Anything else is refused rather than guessed. */
export function parseOffer(uri: string): CredentialOffer {
  if (uri.length > 8192) throw new CredentialError('offer', 'offer too long');
  const m = /^openid-credential-offer:\/\/\?credential_offer=([^&#]+)$/.exec(uri);
  if (!m) throw new CredentialError('offer', 'not a credential offer by value');
  let o: Record<string, any>;
  try {
    o = JSON.parse(decodeURIComponent(m[1]!));
  } catch {
    throw new CredentialError('offer', 'the offer is not JSON');
  }
  if (typeof o.credential_issuer !== 'string' || !/^https:\/\/[^\s/]+(\/[^\s]*)?$/.test(o.credential_issuer)) throw new CredentialError('offer', 'the issuer must be an https URL');
  const ids = o.credential_configuration_ids;
  if (!Array.isArray(ids) || ids.length < 1 || !ids.every((x) => typeof x === 'string')) throw new CredentialError('offer', 'no credential configuration');
  const g = o.grants?.[PRE_AUTH_GRANT];
  if (!g || typeof g['pre-authorized_code'] !== 'string') throw new CredentialError('offer', 'only the pre-authorised code grant is supported');
  return { issuer: o.credential_issuer, configurationIds: ids, preAuthorizedCode: g['pre-authorized_code'], txCode: g.tx_code ? { length: g.tx_code.length, inputMode: g.tx_code.input_mode } : undefined };
}

/** RFC 8615 path-based well-known URI: https://host/path -> https://host/.well-known/<name>/path */
export const wellKnown = (identifier: string, name: string): string => {
  const u = new URL(identifier);
  return `${u.origin}/.well-known/${name}${u.pathname === '/' ? '' : u.pathname}`;
};

const sha256b64u = (s: string): string => createHash('sha256').update(s, 'ascii').digest('base64url');

async function jwt(key: DeviceKey, header: Record<string, unknown>, payload: Record<string, unknown>): Promise<string> {
  const h = b64u(JSON.stringify({ ...header, alg: 'ES256', jwk: key.publicJwk }));
  const p = b64u(JSON.stringify(payload));
  return `${h}.${p}.${b64u(await key.sign(Buffer.from(`${h}.${p}`, 'ascii')))}`;
}

export class Holder {
  constructor(private readonly d: { fetch: Fetch; keys: KeyStore; store: CredentialStore; now?: () => number }) {}

  private now(): number {
    return this.d.now ? this.d.now() : Math.floor(Date.now() / 1000);
  }

  private async json(url: string, init?: Parameters<Fetch>[1]): Promise<{ status: number; body: Record<string, any> }> {
    if (!url.startsWith('https://')) throw new CredentialError('transport', 'https only');
    const r = await this.d.fetch(url, init);
    const text = await r.text();
    let body: Record<string, any> = {};
    try { body = text ? JSON.parse(text) : {}; } catch { /* not JSON */ }
    return { status: r.status, body };
  }

  private async issuerKeys(issuer: string): Promise<JWK[]> {
    const r = await this.json(wellKnown(issuer, 'jwt-vc-issuer'));
    if (r.status !== 200 || r.body.issuer !== issuer || !Array.isArray(r.body.jwks?.keys)) throw new CredentialError('issuer', 'no JWT VC issuer metadata');
    return r.body.jwks.keys;
  }

  /** Accepts an offer: returns the credential kept on the device. The transaction code comes from the person. */
  async accept(offerUri: string, txCode: string, configurationId?: string): Promise<HeldCredential> {
    const offer = parseOffer(offerUri);
    const configId = configurationId ?? offer.configurationIds[0]!;
    if (!offer.configurationIds.includes(configId)) throw new CredentialError('offer', 'that configuration is not offered');
    const meta = await this.json(wellKnown(offer.issuer, 'openid-credential-issuer'));
    if (meta.status !== 200 || meta.body.credential_issuer !== offer.issuer) throw new CredentialError('issuer', 'issuer metadata missing or for another issuer');
    const config = meta.body.credential_configurations_supported?.[configId];
    if (!config || config.format !== 'dc+sd-jwt' || typeof config.vct !== 'string') throw new CredentialError('issuer', 'unsupported credential configuration');
    const as = await this.json(wellKnown(offer.issuer, 'oauth-authorization-server'));
    const tokenEndpoint = as.body.token_endpoint;
    if (as.status !== 200 || as.body.issuer !== offer.issuer || typeof tokenEndpoint !== 'string') throw new CredentialError('issuer', 'no authorization server metadata');

    // DPoP key for this issuance only (a software key is enough: it protects a 5-minute token).
    const dpop = softwareKey();
    const dpopProof = (htu: string, accessToken?: string) => jwt(dpop, { typ: 'dpop+jwt' },
      { htm: 'POST', htu, iat: this.now(), jti: randomUUID(), ...(accessToken ? { ath: sha256b64u(accessToken) } : {}) });
    const t = await this.json(tokenEndpoint, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', dpop: await dpopProof(tokenEndpoint) },
      body: new URLSearchParams({ grant_type: PRE_AUTH_GRANT, 'pre-authorized_code': offer.preAuthorizedCode, tx_code: txCode }).toString(),
    });
    if (t.status !== 200 || t.body.token_type !== 'DPoP' || typeof t.body.access_token !== 'string') throw new CredentialError('token', `token refused: ${t.body.error ?? t.status}`);
    const n = await this.json(meta.body.nonce_endpoint, { method: 'POST' });
    if (typeof n.body.c_nonce !== 'string') throw new CredentialError('nonce', 'no c_nonce');

    const { ref, key } = await this.d.keys.create();
    try {
      const proof = await jwt(key, { typ: 'openid4vci-proof+jwt' }, { aud: offer.issuer, iat: this.now(), nonce: n.body.c_nonce });
      const endpoint = meta.body.credential_endpoint;
      const c = await this.json(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `DPoP ${t.body.access_token}`, dpop: await dpopProof(endpoint, t.body.access_token) },
        body: JSON.stringify({ credential_configuration_id: configId, proofs: { jwt: [proof] } }),
      });
      const sdJwt = c.body.credentials?.[0]?.credential;
      if (c.status !== 200 || typeof sdJwt !== 'string') throw new CredentialError('credential', `credential refused: ${c.body.error ?? c.status}`);
      // Check before keeping: the issuer's signature, the type, and that it is bound to this device key.
      const keys = await this.issuerKeys(offer.issuer);
      const kid = JSON.parse(Buffer.from(sdJwt.split('.')[0]!, 'base64url').toString()).kid;
      const v = await verifyCredential(sdJwt, { issuerKey: async () => keys.find((k) => k.kid === kid) ?? (() => { throw new CredentialError('issuer', 'unknown issuer key'); })(), acceptedVct: [config.vct] });
      const cnf = JSON.parse(Buffer.from(parse(sdJwt).jwt.split('.')[1]!, 'base64url').toString()).cnf?.jwk;
      if (v.iss !== offer.issuer || cnf?.x !== key.publicJwk.x || cnf?.y !== key.publicJwk.y) throw new CredentialError('credential', 'the credential is not for this issuer or not bound to this device');
      const display = Object.fromEntries(((config.credential_metadata?.display ?? []) as { name: string; locale: string }[]).map((x) => [x.locale, x.name]));
      const held: HeldCredential = {
        id: randomUUID(), sdJwt, keyRef: ref, vct: v.vct, issuer: v.iss, issuedAt: v.claims.iat as number, expiresAt: v.claims.exp as number,
        ...(v.status ? { status: v.status.status_list } : {}), display,
      };
      await this.d.store.put(held);
      return held;
    } catch (e) {
      await this.d.keys.remove(ref);
      throw e;
    }
  }

  /** Every claim of a held credential, for the person to see (all disclosures opened locally). */
  async claims(id: string): Promise<VerifiedCredential['claims']> {
    const c = await this.need(id);
    const v = await verifyCredential(c.sdJwt, { issuerKey: async () => this.keyOf(c) });
    return v.claims;
  }

  private async keyOf(c: HeldCredential): Promise<JWK> {
    const keys = await this.issuerKeys(c.issuer);
    const kid = JSON.parse(Buffer.from(c.sdJwt.split('.')[0]!, 'base64url').toString()).kid;
    const k = keys.find((x) => x.kid === kid);
    if (!k) throw new CredentialError('issuer', 'unknown issuer key');
    return k;
  }

  private async need(id: string): Promise<HeldCredential> {
    const c = await this.d.store.get(id);
    if (!c) throw new CredentialError('wallet', 'no such credential');
    return c;
  }

  /**
   * A presentation with only the chosen claim paths (P4-F2), bound to the verifier's audience and nonce. Nested claims
   * bring their parent's disclosure; nothing else is revealed.
   */
  async present(id: string, paths: string[], verifier: { aud: string; nonce: string }): Promise<string> {
    const c = await this.need(id);
    if (c.expiresAt <= this.now()) throw new CredentialError('expired', 'this credential has expired');
    const key = await this.d.keys.get(c.keyRef);
    const all = disclosuresOf(c.sdJwt);
    // Each chosen claim, the disclosures it is nested in, and (for an object) its own disclosable parts.
    const chosen = selectDisclosures({ disclosures: all }, paths).map((d) => d.encoded);
    return present(c.sdJwt, chosen, key, verifier);
  }

  /** The status of a held credential, read from its issuer's status list (0 valid, 1 revoked, 2 suspended). */
  async status(id: string): Promise<number | undefined> {
    const c = await this.need(id);
    if (!c.status) return undefined;
    const r = await this.d.fetch(c.status.uri);
    if (r.status !== 200) throw new CredentialError('status', 'status list unavailable');
    return (await statusFromToken(await r.text(), await this.keyOf(c), c.status.uri, c.status.idx, this.now())).status;
  }

  async remove(id: string): Promise<void> {
    const c = await this.need(id);
    await this.d.store.remove(id);
    await this.d.keys.remove(c.keyRef);
  }

  /** The entry for the cell's wallet API (P4-API3): metadata, and the credential encrypted under the backup key. */
  async backupEntry(id: string, backupKey: Uint8Array): Promise<Record<string, unknown>> {
    const c = await this.need(id);
    return {
      vct: c.vct, issuer: c.issuer, issued_at: new Date(c.issuedAt * 1000).toISOString(), expires_at: new Date(c.expiresAt * 1000).toISOString(),
      ...(c.status ? { status: c.status } : {}),
      backup: { ciphertext: encryptBackup(backupKey, JSON.stringify({ sdJwt: c.sdJwt, display: c.display })).toString('base64url'), key_id: backupKeyId(backupKey) },
    };
  }
}

/** A verifier's request (OpenID4VP 1.0), checked: who asks (from the cell's registry), for which claims. */
export interface PresentationRequest {
  clientId: string;
  /** The verifier's names from the registry, by locale, to show the person who is asking. */
  verifierName: Record<string, string>;
  nonce: string;
  state: string;
  responseUri: string;
  queryId: string;
  vct: string[];
  claims: string[];
  /** Held credentials that can answer (right type, not expired). */
  candidates: HeldCredential[];
}

/** The verifier registry of the person's cell (pre-registered client identifiers; decision Q4-3). */
export type VerifierRegistry = (clientId: string) => Promise<{ client_id: string; client_name?: Record<string, string>; jwks: { keys: JWK[] } }>;

export const REQUEST_TYP = 'oauth-authz-req+jwt';

export class PresentationRequests {
  constructor(private readonly d: { fetch: Fetch; registry: VerifierRegistry; store: CredentialStore; holder: Holder; now?: () => number }) {}

  private now(): number {
    return this.d.now ? this.d.now() : Math.floor(Date.now() / 1000);
  }

  /** Reads an `openid4vp://` request (QR code or link) and checks the signed request object before showing anything. */
  async read(uri: string): Promise<PresentationRequest> {
    if (uri.length > 4096) throw new CredentialError('request', 'request too long');
    const m = /^openid4vp:\/\/\?(.+)$/.exec(uri);
    if (!m) throw new CredentialError('request', 'not an OpenID4VP request');
    const q = new URLSearchParams(m[1]!);
    const clientId = q.get('client_id') ?? '';
    const requestUri = q.get('request_uri') ?? '';
    if (!/^[a-z0-9][a-z0-9.-]{2,100}$/.test(clientId)) throw new CredentialError('request', 'only verifiers registered with the cell are answered');
    if (!requestUri.startsWith('https://')) throw new CredentialError('request', 'request_uri must be https');
    const reg = await this.d.registry(clientId);
    if (reg.client_id !== clientId) throw new CredentialError('request', 'the registry answered for another verifier');
    const r = await this.d.fetch(requestUri);
    const jwt = (await r.text()).trim();
    if (r.status !== 200) throw new CredentialError('request', 'the request object is not available');
    const kid = peekJws(jwt).header.kid;
    const key = reg.jwks.keys.find((k) => k.kid === kid);
    if (!key) throw new CredentialError('request', 'the request is not signed with the verifier\'s registered key');
    const { payload: p } = await verifyJws(jwt, key, REQUEST_TYP);
    if (p.client_id !== clientId || p.aud !== 'https://self-issued.me/v2') throw new CredentialError('request', 'the request is for another client or audience');
    if (p.response_type !== 'vp_token' || p.response_mode !== 'direct_post') throw new CredentialError('request', 'only vp_token by direct_post is supported');
    if (typeof p.response_uri !== 'string' || !p.response_uri.startsWith('https://')) throw new CredentialError('request', 'response_uri must be https');
    if (typeof p.nonce !== 'string' || p.nonce.length < 16 || typeof p.state !== 'string') throw new CredentialError('request', 'nonce and state are required');
    if (typeof p.exp !== 'number' || p.exp < this.now()) throw new CredentialError('request', 'the request has expired');
    const creds = (p.dcql_query as { credentials?: unknown[] } | undefined)?.credentials;
    if (!Array.isArray(creds) || creds.length !== 1) throw new CredentialError('request', 'exactly one credential query is supported');
    const cq = creds[0] as { id?: unknown; format?: unknown; meta?: { vct_values?: unknown }; claims?: { path?: unknown }[] };
    const vct = cq.meta?.vct_values;
    if (typeof cq.id !== 'string' || cq.format !== 'dc+sd-jwt' || !Array.isArray(vct) || !vct.every((x) => typeof x === 'string')) throw new CredentialError('request', 'unsupported credential query');
    if (!Array.isArray(cq.claims) || cq.claims.length < 1) throw new CredentialError('request', 'the verifier must name the claims it needs');
    const claims = cq.claims.map((c) => {
      if (!Array.isArray(c.path) || !c.path.every((x) => typeof x === 'string')) throw new CredentialError('request', 'claim paths are lists of names');
      return (c.path as string[]).join('/');
    });
    const candidates = (await this.d.store.list()).filter((h) => (vct as string[]).includes(h.vct) && h.expiresAt > this.now());
    return { clientId, verifierName: reg.client_name ?? {}, nonce: p.nonce, state: p.state, responseUri: p.response_uri, queryId: cq.id, vct: vct as string[], claims, candidates };
  }

  /** The presentation for a request: only the requested claims, bound to this verifier and nonce. */
  async presentation(req: PresentationRequest, credentialId: string): Promise<string> {
    if (!req.candidates.some((c) => c.id === credentialId)) throw new CredentialError('request', 'that credential does not answer this request');
    return this.d.holder.present(credentialId, req.claims, { aud: req.clientId, nonce: req.nonce });
  }

  /** Answers by direct_post after the person agreed (same-device or cross-device flow). */
  async answer(req: PresentationRequest, credentialId: string): Promise<number> {
    const vp = await this.presentation(req, credentialId);
    const r = await this.d.fetch(req.responseUri, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ vp_token: JSON.stringify({ [req.queryId]: [vp] }), state: req.state }).toString(),
    });
    return r.status;
  }
}

/** AES-256-GCM: 12-byte IV, ciphertext, 16-byte tag. The additional data binds it to CIVORA wallet backups. */
export function encryptBackup(key: Uint8Array, plaintext: string): Buffer {
  if (key.length !== 32) throw new CredentialError('backup', 'the backup key is 32 bytes');
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  c.setAAD(Buffer.from('civora-wallet-backup-v1'));
  const ct = Buffer.concat([c.update(plaintext, 'utf8'), c.final()]);
  return Buffer.concat([iv, ct, c.getAuthTag()]);
}

export function decryptBackup(key: Uint8Array, blob: Uint8Array): string {
  if (key.length !== 32 || blob.length < 29) throw new CredentialError('backup', 'bad key or ciphertext');
  const b = Buffer.from(blob);
  const d = createDecipheriv('aes-256-gcm', key, b.subarray(0, 12));
  d.setAAD(Buffer.from('civora-wallet-backup-v1'));
  d.setAuthTag(b.subarray(b.length - 16));
  try {
    return Buffer.concat([d.update(b.subarray(12, b.length - 16)), d.final()]).toString('utf8');
  } catch {
    throw new CredentialError('backup', 'the backup does not open with this key (wrong key or altered)');
  }
}

/** The key's identifier: a digest under a fixed label, so it says nothing about the key itself. */
export const backupKeyId = (key: Uint8Array): string => createHash('sha256').update('civora-wallet-backup-key-id\0').update(key).digest('base64url');
