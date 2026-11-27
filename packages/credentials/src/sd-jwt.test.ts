import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { b64u, CredentialError, sha256b64u, signJws } from './jws';
import { softwareKey } from './keys';
import { disclosuresOf, issueSdJwt, parse, present, selectDisclosures, trimSlashes, verifySdJwt } from './sd-jwt';

const rejects = (p: Promise<unknown>, code: string) => assert.rejects(p, (e: unknown) => e instanceof CredentialError && e.code === code, `expected ${code}`);

describe('SD-JWT (RFC 9901)', () => {
  it('the digest of a disclosure is SHA-256 over its base64url text (the RFC\'s "Möbius" example)', () => {
    const d = 'WyI2cU1RdlJMNWhhaiIsICJmYW1pbHlfbmFtZSIsICJNw7ZiaXVzIl0';
    assert.equal(sha256b64u(d), 'uutlBuYeMDyjLLTpf6Jxi7yNkEF35jdyWMn9U7b_RYY');
  });

  const issuer = softwareKey({ kid: 'issuer-1' });
  const holder = softwareKey();
  const claims = {
    iss: 'https://issuer.example.invalid', iat: 1_800_000_000, exp: 4_000_000_000, cnf: { jwk: holder.publicJwk },
    given_name: 'Amina', family_name: 'Ben Salah', birthdate: '1990-01-01',
    address: { locality: 'Tunis', street_address: 'Rue 1' }, nationalities: ['TN', 'FR'],
  };
  const sd = ['given_name', 'family_name', 'birthdate', 'address', 'address/street_address', 'nationalities/1'];
  const key = async () => issuer.publicJwk;
  const kb = { aud: 'https://verifier.example.invalid', nonce: 'n-0123456789' };

  it('issues digests in place of the chosen claims, with decoys, and nothing in clear', async () => {
    const issued = await issueSdJwt(issuer, 'example+sd-jwt', claims, sd, 3);
    const payload = JSON.parse(Buffer.from(issued.sdJwt.split('.')[1]!, 'base64url').toString());
    assert.equal(payload._sd_alg, 'sha-256');
    assert.equal(payload.given_name, undefined);
    assert.equal(payload._sd.length, 4 + 3, '4 top-level disclosable claims and 3 decoys');
    assert.deepEqual([...payload._sd].sort(), payload._sd, 'digests sorted (order says nothing)');
    assert.deepEqual(payload.nationalities[0], 'TN');
    assert.ok(payload.nationalities[1]['...']);
    assert.equal(issued.disclosures.length, 6);
    assert.ok(!issued.sdJwt.includes('Amina'));
  });

  it('a holder discloses only what it chooses; the verifier sees exactly that, bound to its nonce', async () => {
    const issued = await issueSdJwt(issuer, 'example+sd-jwt', claims, sd);
    const chosen = selectDisclosures(issued, ['given_name', 'address/locality']);
    assert.deepEqual(chosen.map((d) => d.path).sort(), ['address', 'given_name'], 'a nested claim needs its parent disclosure');
    const vp = await present(issued.sdJwt, chosen.map((d) => d.encoded), holder, kb);
    const v = await verifySdJwt(vp, { issuerKey: key, typ: 'example+sd-jwt', keyBinding: kb });
    assert.equal(v.claims.given_name, 'Amina');
    assert.equal(v.claims.family_name, undefined);
    assert.deepEqual(v.claims.address, { locality: 'Tunis' }, 'street_address not disclosed');
    assert.deepEqual(v.claims.nationalities, ['TN'], 'an undisclosed array element is left out');
    assert.deepEqual(v.disclosedPaths.sort(), ['address', 'given_name']);
  });

  it('claim paths are trimmed of "/" in linear time, whatever the input (no backtracking regex)', () => {
    assert.equal(trimSlashes('/address/locality/'), 'address/locality');
    assert.equal(trimSlashes('///'), '');
    const hostile = `a${'/'.repeat(200_000)}b`;
    const t0 = process.hrtime.bigint();
    assert.equal(trimSlashes(hostile), hostile);
    assert.ok(Number(process.hrtime.bigint() - t0) / 1e6 < 50, 'well under 50 ms');
  });

  it('the holder finds the path of every disclosure of its credential from the credential alone', async () => {
    const issued = await issueSdJwt(issuer, 'example+sd-jwt', claims, sd, 2);
    const found = disclosuresOf(issued.sdJwt).map((d) => [d.path, d.encoded]).sort();
    assert.deepEqual(found, issued.disclosures.map((d) => [d.path, d.encoded]).sort());
    assert.deepEqual(selectDisclosures({ disclosures: disclosuresOf(issued.sdJwt) }, ['address/street_address']).map((d) => d.path).sort(), ['address', 'address/street_address']);
  });

  it('refuses: a forged or altered issuer signature, alg none, the wrong typ, a foreign or duplicated disclosure, a claim both clear and disclosed', async () => {
    const issued = await issueSdJwt(issuer, 'example+sd-jwt', claims, sd);
    const p = parse(issued.sdJwt);
    const [h, pl, s] = p.jwt.split('.');
    const tampered = JSON.parse(Buffer.from(pl!, 'base64url').toString());
    tampered.exp = 4_100_000_000;
    await rejects(verifySdJwt([`${h}.${b64u(JSON.stringify(tampered))}.${s}`, ...p.disclosures].join('~') + '~', { issuerKey: key, typ: 'example+sd-jwt' }), 'signature');
    const other = softwareKey({ kid: 'issuer-1' });
    await rejects(verifySdJwt(issued.sdJwt, { issuerKey: async () => other.publicJwk, typ: 'example+sd-jwt' }), 'signature');
    const none = `${b64u(JSON.stringify({ alg: 'none', typ: 'example+sd-jwt' }))}.${pl}.`;
    await rejects(verifySdJwt([none, ...p.disclosures].join('~') + '~', { issuerKey: key, typ: 'example+sd-jwt' }), 'alg');
    await rejects(verifySdJwt(issued.sdJwt, { issuerKey: key, typ: 'dc+sd-jwt' }), 'typ');
    const foreign = b64u(JSON.stringify(['salt-salt-salt', 'given_name', 'Mallory']));
    await rejects(verifySdJwt(`${p.jwt}~${foreign}~`, { issuerKey: key, typ: 'example+sd-jwt' }), 'disclosure');
    await rejects(verifySdJwt(`${p.jwt}~${p.disclosures[0]}~${p.disclosures[0]}~`, { issuerKey: key, typ: 'example+sd-jwt' }), 'disclosure');
    // An issuer that put a claim both in clear and behind a digest: the verifier refuses rather than choose.
    const d = b64u(JSON.stringify(['s'.repeat(22), 'iss', 'https://evil.example.invalid']));
    const jwt = await signJws(issuer, { typ: 'example+sd-jwt' }, { iss: 'https://issuer.example.invalid', exp: 4_000_000_000, _sd: [sha256b64u(d)], _sd_alg: 'sha-256' });
    await rejects(verifySdJwt(`${jwt}~${d}~`, { issuerKey: key, typ: 'example+sd-jwt' }), 'claims');
  });

  it('key binding: required when asked; wrong audience, wrong or replayed nonce, stale iat, another holder key, a changed disclosure set: refused', async () => {
    const issued = await issueSdJwt(issuer, 'example+sd-jwt', claims, sd);
    const all = issued.disclosures.map((d) => d.encoded);
    const vp = await present(issued.sdJwt, all, holder, kb);
    await rejects(verifySdJwt(issued.sdJwt, { issuerKey: key, typ: 'example+sd-jwt', keyBinding: kb }), 'key-binding');
    await rejects(verifySdJwt(vp, { issuerKey: key, typ: 'example+sd-jwt', keyBinding: { ...kb, aud: 'https://other.example.invalid' } }), 'key-binding');
    await rejects(verifySdJwt(vp, { issuerKey: key, typ: 'example+sd-jwt', keyBinding: { ...kb, nonce: 'n-other' } }), 'key-binding');
    const old = await present(issued.sdJwt, all, holder, { ...kb, iat: Math.floor(Date.now() / 1000) - 3600 });
    await rejects(verifySdJwt(old, { issuerKey: key, typ: 'example+sd-jwt', keyBinding: kb }), 'key-binding');
    const thief = softwareKey();
    await rejects(verifySdJwt(await present(issued.sdJwt, all, thief, kb), { issuerKey: key, typ: 'example+sd-jwt', keyBinding: kb }), 'signature');
    const dropped = vp.replace(`~${all[0]}~`, '~');
    await rejects(verifySdJwt(dropped, { issuerKey: key, typ: 'example+sd-jwt', keyBinding: kb }), 'key-binding');
    await rejects(verifySdJwt(vp, { issuerKey: key, typ: 'example+sd-jwt' }), 'key-binding');
  });

  it('expiry and not-before are checked (with one minute of clock skew)', async () => {
    const issued = await issueSdJwt(issuer, 'example+sd-jwt', { ...claims, exp: 1_900_000_000, nbf: 1_850_000_000 }, []);
    await rejects(verifySdJwt(issued.sdJwt, { issuerKey: key, typ: 'example+sd-jwt', now: 1_900_000_100 }), 'expired');
    await rejects(verifySdJwt(issued.sdJwt, { issuerKey: key, typ: 'example+sd-jwt', now: 1_849_999_000 }), 'not-yet-valid');
    assert.ok(await verifySdJwt(issued.sdJwt, { issuerKey: key, typ: 'example+sd-jwt', now: 1_899_999_000 }));
  });
});
