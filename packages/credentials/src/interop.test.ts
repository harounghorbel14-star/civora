import { strict as assert } from 'node:assert';
import { createHash, createPublicKey, randomBytes, verify as cryptoVerify } from 'node:crypto';
import { describe, it } from 'node:test';
import type { JWK } from 'jose';
import { CredentialError } from './jws';
import { softwareKey, type SoftwareKey } from './keys';
import { parse, present } from './sd-jwt';
import { issueCredential, verifyCredential } from './sd-jwt-vc';
import { signStatusList, STATUS, StatusList } from './status-list';

/**
 * Interoperability (P4-T2) with an independent implementation: the OpenWallet Foundation's @sd-jwt/sd-jwt-vc 0.24.3
 * (Apache-2.0; released 3 Nov 2026), used as the external issuer, holder and verifier. CIVORA's credentials, key
 * binding and status lists must be accepted by it, and its credentials by CIVORA's verifier.
 */
const b64uSig = (k: SoftwareKey) => async (data: string) => Buffer.from(await k.sign(Buffer.from(data, 'ascii'))).toString('base64url');
const verifyWith = (jwk: JWK) => async (data: string, sig: string) =>
  cryptoVerify('sha256', Buffer.from(data, 'ascii'), { key: createPublicKey({ key: jwk as never, format: 'jwk' }), dsaEncoding: 'ieee-p1363' }, Buffer.from(sig, 'base64url'));
const hasher = async (data: string | ArrayBuffer, alg: string) => {
  assert.equal(alg, 'sha-256');
  return new Uint8Array(createHash('sha256').update(typeof data === 'string' ? Buffer.from(data, 'utf8') : Buffer.from(data)).digest());
};

describe('interoperability with @sd-jwt/sd-jwt-vc (OpenWallet Foundation)', async () => {
  const { SDJwtVcInstance } = await import('@sd-jwt/sd-jwt-vc');
  const issuer = softwareKey({ kid: 'demo-issuer-1' });
  const holder = softwareKey();
  const STATUS_URI = 'https://wallet.civora-cell.invalid/v1/status-lists/9';
  const list = new StatusList(1, 1024);
  list.set(5, STATUS.INVALID);
  const statusToken = await signStatusList(issuer, STATUS_URI, list);
  const kb = { aud: 'https://verifier.example.invalid', nonce: randomBytes(16).toString('base64url') };
  const external = () => new SDJwtVcInstance({
    signer: b64uSig(issuer), signAlg: 'ES256', verifier: verifyWith(issuer.publicJwk),
    kbSigner: b64uSig(holder), kbSignAlg: 'ES256',
    kbVerifier: async (data: string, sig: string, payload: Record<string, unknown>) => verifyWith((payload.cnf as { jwk: JWK }).jwk)(data, sig),
    hasher, hashAlg: 'sha-256', saltGenerator: async (n: number) => randomBytes(n).toString('base64url'),
    statusListFetcher: async (uri: string) => { assert.equal(uri, STATUS_URI); return statusToken; },
    statusVerifier: verifyWith(issuer.publicJwk),
  });
  const civoraCredential = (idx: number) => issueCredential(issuer, {
    iss: 'https://wallet.civora-cell.invalid/issuers/demo', vct: 'urn:civora:tn:synthetic:residence-certificate:1', holderJwk: holder.publicJwk,
    exp: Math.floor(Date.now() / 1000) + 3600, status: { status_list: { idx, uri: STATUS_URI } },
    claims: { given_name: 'Synthetic', family_name: 'Person', address: { locality: 'Sousse' } },
    selectivelyDisclosable: ['given_name', 'family_name', 'address', 'address/locality'],
  });

  it('a CIVORA credential, presented by the external holder, verifies at the external verifier (key binding and our status list)', async () => {
    const issued = await civoraCredential(3);
    const vp = await external().present(issued.sdJwt, { given_name: true }, { kb: { payload: { iat: Math.floor(Date.now() / 1000), ...kb } } });
    const v = await external().verify(vp, { keyBindingNonce: kb.nonce, expectedKeyBindingAudience: kb.aud });
    assert.equal(v.payload.given_name, 'Synthetic');
    assert.equal(v.payload.family_name, undefined);
    assert.ok(v.kb, 'key binding checked');
  });

  it('a CIVORA presentation (our holder code) verifies at the external verifier; a revoked index is refused there by our status list', async () => {
    const issued = await civoraCredential(3);
    const chosen = issued.disclosures.filter((d) => d.path === 'address' || d.path === 'address/locality').map((d) => d.encoded);
    const vp = await present(issued.sdJwt, chosen, holder, kb);
    const v = await external().verify(vp, { keyBindingNonce: kb.nonce, expectedKeyBindingAudience: kb.aud });
    assert.deepEqual(v.payload.address, { locality: 'Sousse' });
    const revoked = await civoraCredential(5);
    const vp2 = await present(revoked.sdJwt, [], holder, kb);
    await assert.rejects(external().verify(vp2, { keyBindingNonce: kb.nonce, expectedKeyBindingAudience: kb.aud }), 'the external verifier reads index 5 as revoked in our list');
  });

  it('an external credential, presented by the external holder, verifies at the CIVORA verifier; a wrong nonce is refused', async () => {
    const ext = external();
    const credential = await ext.issue({
      iss: 'https://external-issuer.example.invalid', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600,
      vct: 'urn:example:diploma', cnf: { jwk: holder.publicJwk }, given_name: 'Ext', degree: { name: 'MSc', year: 2020 },
    }, { _sd: ['given_name', 'degree'], degree: { _sd: ['year'] } } as never, { header: { kid: 'demo-issuer-1' } });
    const vp = await ext.present(credential, { degree: { name: true } } as never, { kb: { payload: { iat: Math.floor(Date.now() / 1000), ...kb } } });
    const v = await verifyCredential(vp, { issuerKey: async () => issuer.publicJwk, keyBinding: kb, acceptedVct: ['urn:example:diploma'] });
    assert.equal(v.claims.given_name, undefined);
    assert.equal((v.claims.degree as { name: string }).name, 'MSc');
    assert.equal((v.claims.degree as { year?: number }).year, undefined, 'year is its own disclosure: asked for name only, the external holder left it out');
    await assert.rejects(verifyCredential(vp, { issuerKey: async () => issuer.publicJwk, keyBinding: { ...kb, nonce: 'other' } }),
      (e: unknown) => e instanceof CredentialError && e.code === 'key-binding');
  });

  it('an external credential presented by the CIVORA holder code verifies at both verifiers', async () => {
    const ext = external();
    const credential = await ext.issue({
      iss: 'https://external-issuer.example.invalid', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600,
      vct: 'urn:example:diploma', cnf: { jwk: holder.publicJwk }, given_name: 'Ext', family_name: 'Holder',
    }, { _sd: ['given_name', 'family_name'] } as never, { header: { kid: 'demo-issuer-1' } });
    const p = parse(credential);
    const given = p.disclosures.find((d) => Buffer.from(d, 'base64url').toString().includes('given_name'))!;
    const vp = await present(credential, [given], holder, kb);
    const ours = await verifyCredential(vp, { issuerKey: async () => issuer.publicJwk, keyBinding: kb });
    assert.equal(ours.claims.given_name, 'Ext');
    assert.equal(ours.claims.family_name, undefined);
    const theirs = await ext.verify(vp, { keyBindingNonce: kb.nonce, expectedKeyBindingAudience: kb.aud });
    assert.equal(theirs.payload.given_name, 'Ext');
  });
});
