import { deflateSync, inflateSync } from 'node:zlib';
import type { JWK } from 'jose';
import { b64u, CredentialError, fromB64u, type Signer, signJws, verifyJws } from './jws';

/**
 * Token Status List (IETF draft-ietf-oauth-status-list, -21 of June 2026): the status of many credentials in one
 * compressed bit array, published as a signed JWT (typ statuslist+jwt). Each credential points at an index. Values:
 * 0 valid, 1 invalid (revoked), 2 suspended. The array is DEFLATE-compressed in the ZLIB format and base64url-encoded;
 * index 0 sits in the least significant bits of the first byte.
 */
export const STATUS = { VALID: 0, INVALID: 1, SUSPENDED: 2 } as const;
export type Bits = 1 | 2 | 4 | 8;
export const STATUS_LIST_TYP = 'statuslist+jwt';

export class StatusList {
  readonly bytes: Uint8Array;

  constructor(readonly bits: Bits, readonly size: number, bytes?: Uint8Array) {
    if (![1, 2, 4, 8].includes(bits)) throw new CredentialError('status', 'bits must be 1, 2, 4 or 8');
    if (!Number.isInteger(size) || size < 1 || size > 1 << 24) throw new CredentialError('status', 'size out of range');
    const len = Math.ceil((size * bits) / 8);
    if (bytes && bytes.length < len) throw new CredentialError('status', 'list shorter than its size');
    this.bytes = bytes ? Uint8Array.from(bytes) : new Uint8Array(len);
  }

  get(idx: number): number {
    this.check(idx);
    const bit = idx * this.bits;
    return (this.bytes[bit >> 3]! >> (bit & 7)) & ((1 << this.bits) - 1);
  }

  set(idx: number, value: number): void {
    this.check(idx);
    const max = (1 << this.bits) - 1;
    if (!Number.isInteger(value) || value < 0 || value > max) throw new CredentialError('status', `value must be 0..${max}`);
    const bit = idx * this.bits;
    const i = bit >> 3;
    const shift = bit & 7;
    this.bytes[i] = (this.bytes[i]! & ~(max << shift)) | (value << shift);
  }

  private check(idx: number): void {
    if (!Number.isInteger(idx) || idx < 0 || idx >= this.size) throw new CredentialError('status', 'index out of range');
  }

  /** The `lst` value: ZLIB-compressed, base64url. */
  encode(): string {
    return b64u(deflateSync(this.bytes, { level: 9 }));
  }

  static decode(bits: Bits, lst: string, maxBytes = 1 << 24): StatusList {
    let raw: Buffer;
    try {
      raw = inflateSync(fromB64u(lst), { maxOutputLength: maxBytes });
    } catch {
      throw new CredentialError('status', 'lst is not ZLIB data within the size limit');
    }
    return new StatusList(bits, Math.floor((raw.length * 8) / bits), raw);
  }
}

export async function signStatusList(signer: Signer, uri: string, list: StatusList, opts: { ttl?: number; exp?: number; iat?: number } = {}): Promise<string> {
  const iat = opts.iat ?? Math.floor(Date.now() / 1000);
  return signJws(signer, { typ: STATUS_LIST_TYP }, {
    sub: uri, iat, ...(opts.exp ? { exp: opts.exp } : {}), ...(opts.ttl ? { ttl: opts.ttl } : {}),
    status_list: { bits: list.bits, lst: list.encode() },
  });
}

/** Verifies a status list token for `uri` and returns the status at `idx` (and the token's iat/ttl for caching). */
export async function statusFromToken(token: string, issuerKey: JWK, uri: string, idx: number, now = Math.floor(Date.now() / 1000)): Promise<{ status: number; iat: number; ttl?: number }> {
  const { payload } = await verifyJws(token, issuerKey, STATUS_LIST_TYP);
  if (payload.sub !== uri) throw new CredentialError('status', 'the status list is for another URI');
  if (typeof payload.exp === 'number' && now > payload.exp) throw new CredentialError('status', 'the status list has expired');
  const sl = payload.status_list as { bits?: unknown; lst?: unknown } | undefined;
  if (!sl || ![1, 2, 4, 8].includes(sl.bits as number) || typeof sl.lst !== 'string') throw new CredentialError('status', 'malformed status_list');
  const list = StatusList.decode(sl.bits as Bits, sl.lst);
  if (idx >= list.size) throw new CredentialError('status', 'index beyond the list');
  return { status: list.get(idx), iat: payload.iat as number, ttl: typeof payload.ttl === 'number' ? payload.ttl : undefined };
}
