import { strict as assert } from 'node:assert';
import { createHash, randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import { calculateJwkThumbprint, exportJWK, generateKeyPair, type JWK, SignJWT } from 'jose';
import { DpopError, loadDpopConfig, verifyDpopProof } from './dpop';

const URL_ = 'https://api.cell.invalid/v1/me';
const TOKEN = 'eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJ4In0.c2lnbmF0dXJlLXBsYWNlaG9sZGVy';
const ath = (t: string) => createHash('sha256').update(t, 'ascii').digest('base64url');

async function setup() {
  const { publicKey, privateKey } = await generateKeyPair('ES256', { extractable: true });
  const jwk = await exportJWK(publicKey);
  const jkt = await calculateJwkThumbprint(jwk, 'sha256');
  const seen = new Set<string>();
  const claimJti = async (d: Buffer) => { const k = d.toString('hex'); if (seen.has(k)) return false; seen.add(k); return true; };
  const proof = (o: { htm?: string; htu?: string; iat?: number; ath?: string; jti?: string; jwk?: JWK; typ?: string } = {}) =>
    new SignJWT({ htm: o.htm ?? 'GET', htu: o.htu ?? URL_, ath: o.ath ?? ath(TOKEN), jti: o.jti ?? randomUUID() })
      .setProtectedHeader({ alg: 'ES256', typ: o.typ ?? 'dpop+jwt', jwk: o.jwk ?? jwk })
      .setIssuedAt(o.iat ?? Math.floor(Date.now() / 1000))
      .sign(privateKey);
  const check = (p: string, extra: Partial<Parameters<typeof verifyDpopProof>[0]> = {}) =>
    verifyDpopProof({ proof: p, method: 'GET', urls: [URL_], accessToken: TOKEN, jkt, claimJti, ...extra });
  return { proof, check, jwk, privateKey };
}

describe('DPoP proofs (RFC 9449; ASVS V10.3.5)', () => {
  it('a fresh proof for this request, this token and the bound key is accepted once; its replay is refused', async () => {
    const { proof, check } = await setup();
    const p = await proof({ jti: 'fixed-identifier-1' });
    await check(p);
    await assert.rejects(check(p), /already used/);
  });

  it('refused: another method, another URL, another token, too old, from the future', async () => {
    const { proof, check } = await setup();
    await assert.rejects(check(await proof({ htm: 'POST' })), /another method/);
    await assert.rejects(check(await proof({ htu: 'https://api.cell.invalid/v1/mandates' })), /another URL/);
    await assert.rejects(check(await proof({ ath: ath('another-token') })), /another token/);
    await assert.rejects(check(await proof({ iat: Math.floor(Date.now() / 1000) - 120 })), /too old/);
    await assert.rejects(check(await proof({ iat: Math.floor(Date.now() / 1000) + 120 })), /from the future/);
  });

  it('refused: a proof signed by another key (the token is bound to a different thumbprint)', async () => {
    const { check } = await setup();
    const other = await setup();
    await assert.rejects(check(await other.proof()), /not the key the token is bound to/);
  });

  it('refused: a private key in the header, a wrong type, garbage', async () => {
    const { proof, check, privateKey } = await setup();
    const priv = await exportJWK(privateKey);
    await assert.rejects(check(await proof({ jwk: priv })), DpopError);
    await assert.rejects(check(await proof({ typ: 'JWT' })), /invalid proof signature/);
    await assert.rejects(check('not-a-proof-at-all-just-some-characters'), DpopError);
  });

  it('the URL may be any of the configured public bases plus the path; query strings are ignored', async () => {
    const { proof, check } = await setup();
    await check(await proof({ htu: `${URL_}?x=1` }), { urls: ['http://core.internal:3000/v1/me', URL_] });
  });

  it('configuration: public base URLs validated; the web and mobile apps must use DPoP by default', () => {
    assert.deepEqual([...loadDpopConfig({}).requiredClients], ['civora-web', 'civora-mobile']);
    assert.deepEqual(loadDpopConfig({ CORE_PUBLIC_URLS: 'https://api.cell.invalid/, http://core:3000' }).publicUrls, ['https://api.cell.invalid', 'http://core:3000']);
    assert.throws(() => loadDpopConfig({ CORE_PUBLIC_URLS: 'https://api.cell.invalid/v1' }), /not a base URL/);
  });
});
