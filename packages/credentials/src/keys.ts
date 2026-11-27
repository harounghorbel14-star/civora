import { createPublicKey, generateKeyPairSync, type KeyObject, sign } from 'node:crypto';
import type { JWK } from 'jose';
import type { Signer } from './jws';

/**
 * A software ES256 key (P-256): device keys of the holder library and keys in tests. Issuer keys live in the HSM
 * (PKCS#11; SoftHSM in dev and test) behind the same Signer interface, never as software keys in production.
 */
export interface SoftwareKey extends Signer {
  publicJwk: JWK;
  privateKey: KeyObject;
}

export function softwareKey(header: 'jwk' | { kid: string } = 'jwk', privateKey?: KeyObject): SoftwareKey {
  const priv = privateKey ?? generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey;
  const pub = createPublicKey(priv).export({ format: 'jwk' }) as JWK;
  const publicJwk: JWK = { kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y };
  return {
    alg: 'ES256',
    header: header === 'jwk' ? { jwk: publicJwk } : header,
    publicJwk,
    privateKey: priv,
    sign: async (input) => sign('sha256', input, { key: priv, dsaEncoding: 'ieee-p1363' }),
  };
}
