import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { CredentialError } from './jws';
import { softwareKey } from './keys';
import { present } from './sd-jwt';
import { issueCredential, verifyCredential } from './sd-jwt-vc';
import { signStatusList, STATUS, StatusList, statusFromToken } from './status-list';

const rejects = (p: Promise<unknown>, code: string) => assert.rejects(p, (e: unknown) => e instanceof CredentialError && e.code === code, `expected ${code}`);

describe('SD-JWT VC (draft-ietf-oauth-sd-jwt-vc) and Token Status List (draft-ietf-oauth-status-list)', () => {
  const issuer = softwareKey({ kid: 'demo-issuer-2026-1' });
  const holder = softwareKey();
  const STATUS_URI = 'https://wallet.civora-cell.invalid/v1/status-lists/1';
  const base = {
    iss: 'https://wallet.civora-cell.invalid/issuers/demo-civil-registry', vct: 'urn:civora:tn:synthetic:residence-certificate:1', holderJwk: holder.publicJwk,
    exp: Math.floor(Date.now() / 1000) + 86400, status: { status_list: { idx: 7, uri: STATUS_URI } },
    claims: { given_name: 'Synthetic', family_name: 'Person', locality: 'Sfax' }, selectivelyDisclosable: ['given_name', 'family_name', 'locality'],
  };

  it('typ dc+sd-jwt, vct, cnf and status in clear; processing claims can never be selectively disclosable', async () => {
    const issued = await issueCredential(issuer, base);
    const header = JSON.parse(Buffer.from(issued.sdJwt.split('.')[0]!, 'base64url').toString());
    assert.equal(header.typ, 'dc+sd-jwt');
    assert.equal(header.kid, 'demo-issuer-2026-1');
    await rejects(issueCredential(issuer, { ...base, selectivelyDisclosable: ['status'] }), 'claims');
    await rejects(issueCredential(issuer, { ...base, claims: { ...base.claims, vct: 'x' } }), 'claims');
    await rejects(issueCredential(issuer, { ...base, holderJwk: { ...holder.publicJwk, d: 'x' } }), 'key');
  });

  it('verifies a presentation of the type expected, with its status reference; refuses another type', async () => {
    const issued = await issueCredential(issuer, base);
    const kb = { aud: 'x509_san_dns:verifier.example.invalid', nonce: 'nonce-1234567890' };
    const vp = await present(issued.sdJwt, [issued.disclosures.find((d) => d.path === 'locality')!.encoded], holder, kb);
    const v = await verifyCredential(vp, { issuerKey: async () => issuer.publicJwk, keyBinding: kb, acceptedVct: [base.vct] });
    assert.equal(v.claims.locality, 'Sfax');
    assert.equal(v.claims.given_name, undefined);
    assert.deepEqual(v.status, base.status);
    await rejects(verifyCredential(vp, { issuerKey: async () => issuer.publicJwk, keyBinding: kb, acceptedVct: ['urn:other'] }), 'vct');
  });

  it('status list: values in place, index 0 in the low bits of byte 0, ZLIB round trip; revoked and suspended read back from a signed token', async () => {
    const list = new StatusList(2, 16);
    list.set(0, STATUS.INVALID);
    list.set(1, STATUS.SUSPENDED);
    list.set(7, STATUS.INVALID);
    assert.equal(list.bytes[0], 0b1001, 'idx 0 = 01 (bits 0-1), idx 1 = 10 (bits 2-3)');
    const back = StatusList.decode(2, list.encode());
    assert.deepEqual([back.get(0), back.get(1), back.get(2), back.get(7)], [1, 2, 0, 1]);
    const token = await signStatusList(issuer, STATUS_URI, list, { ttl: 3600 });
    assert.equal((await statusFromToken(token, issuer.publicJwk, STATUS_URI, 7)).status, STATUS.INVALID);
    assert.equal((await statusFromToken(token, issuer.publicJwk, STATUS_URI, 3)).status, STATUS.VALID);
    await rejects(statusFromToken(token, issuer.publicJwk, 'https://other.example.invalid/1', 7), 'status');
    await rejects(statusFromToken(token, softwareKey().publicJwk, STATUS_URI, 7), 'signature');
    await rejects(statusFromToken(token, issuer.publicJwk, STATUS_URI, 99), 'status');
    assert.throws(() => list.set(0, 4), CredentialError);
    assert.throws(() => StatusList.decode(1, 'not-zlib'), CredentialError);
  });

  it('a 1-bit list of 100 000 credentials stays small (a few bytes when nearly all are valid)', () => {
    const list = new StatusList(1, 100_000);
    list.set(42_000, STATUS.INVALID);
    assert.ok(list.encode().length < 400, `${list.encode().length} characters`);
  });
});
