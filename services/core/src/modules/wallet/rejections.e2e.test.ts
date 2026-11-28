import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { b64u, issueCredential, type Issued, peekJws, present, softwareKey } from '@civora/credentials';
import { Holder, MemoryCredentialStore, MemoryKeyStore, PresentationRequests } from '@civora/holder';
import { display, hsmInstalled, mappedFetch, PUBLIC, startWalletCell, type WalletCell } from './testkit.test.helper';

/**
 * Phase 4 week 6 (P4-AC2, P4-T3; doc phase-4/07): the verifier API refuses revoked, suspended, expired and tampered
 * credentials — every case of the matrix, through both routes that decide (the wallet's direct_post and the verifier
 * device's /v1/verify) — and seeded fuzzing of the presentation through /v1/verify never gets one accepted, never a
 * server error. Besides the cell's issuer (key in SoftHSM), a test-only issuer whose key is a software key is registered,
 * so that credentials the cell would never issue (expired, not yet valid, another type) can be made. Synthetic data only.
 * Needs TEST_DATABASE_URL and SoftHSM.
 */
const adminUrl = process.env.TEST_DATABASE_URL;
const required = process.env.CIVORA_HSM_TESTS === 'required';
const skip = !adminUrl ? 'TEST_DATABASE_URL not set' : !hsmInstalled && !required ? 'SoftHSM 2 and OpenSC are not installed (CI requires them)' : false;
const SEED = Number(process.env.CIVORA_FUZZ_SEED ?? 20261128);
const API_CASES = Number(process.env.CIVORA_FUZZ_API_CASES ?? 160);

const ISSUER = `${PUBLIC}/issuers/demo-civil-registry`;
const VCT = 'urn:civora:tn:synthetic:residence-certificate:1';
const TEST_ISSUER = `${PUBLIC}/issuers/test-signer`;
const VCT2 = 'urn:civora:tn:synthetic:test-only-attestation:1';
const VCT2B = 'urn:civora:tn:synthetic:test-only-other-type:1';
const HELD_ISSUER = `${PUBLIC}/issuers/test-signer-held`;
const VCT3 = 'urn:civora:tn:synthetic:test-only-held-issuer:1';
const VERIFIER = 'verifier.demo-bank.civora-cell.invalid';
const TENANT = randomUUID();
const ANY = Symbol('any reason');

/** The unused low bits of the last character set: the same bytes, a second encoding (base64url malleability). */
const nonCanonical = (seg: string): string => {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const unused = (seg.length * 6) % 8;
  assert.ok(unused > 0, 'a segment with unused bits');
  return seg.slice(0, -1) + A[A.indexOf(seg.at(-1)!) | 1];
};
const lastSeg = (jws: string, f: (s: string) => string) => jws.slice(0, jws.lastIndexOf('.') + 1) + f(jws.slice(jws.lastIndexOf('.') + 1));
const prng = (seed: number) => {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
};

describe('the verifier refuses revoked, suspended, expired and tampered credentials (P4-AC2, P4-T3)', { skip }, () => {
  let cell: WalletCell;
  const testSigner = softwareKey({ kid: 'test-signer-1' });
  const heldSigner = softwareKey({ kid: 'test-signer-held-1' });
  const holderKey = softwareKey();
  const otherKey = softwareKey();
  let heldIssuerId = '';

  before(async () => {
    assert.ok(hsmInstalled, 'softhsm2 and opensc must be installed when CIVORA_HSM_TESTS=required');
    cell = await startWalletCell(adminUrl!, async (admin, ceremony) => {
      const reg = (slug: string, url: string, kid: string, jwk: unknown, keyId: string) =>
        admin.query('select wallet.register_issuer($1,$2,$3,$4,$5,$6,$7) as id', [slug, url, display(slug), kid, jwk, 'civora-wallet', keyId]).then((r) => r.rows[0].id as string);
      const type = (issuer: string, vct: string) => admin.query('select wallet.register_credential_type($1,$2,$3,$4,$5,$6,$7,$8)',
        [issuer, vct, display(vct), ['given_name', 'family_name', 'birthdate', 'address', 'address/locality', 'address/country'],
          ['given_name', 'family_name', 'birthdate', 'address/locality'], 365, 'residence-certificate', [30, 7]]);
      await type(await reg('demo-civil-registry', ISSUER, 'demo-civil-registry-1', ceremony('01', 'demo-civil-registry-1'), '01'), VCT);
      // Test-only issuers: their keys are software keys (never in the HSM, never used by the cell to issue).
      const test = await reg('test-signer', TEST_ISSUER, 'test-signer-1', testSigner.publicJwk, '0e');
      await type(test, VCT2);
      await type(test, VCT2B);
      heldIssuerId = await reg('test-signer-held', HELD_ISSUER, 'test-signer-held-1', heldSigner.publicJwk, '0f');
      await type(heldIssuerId, VCT3);
      await admin.query('select wallet.register_verifier($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [VERIFIER, display('Demo bank (verifier)'), ceremony('02', 'demo-bank-verifier-1'), 'demo-bank-verifier-1', 'civora-wallet', '02',
          [VCT, VCT2, VCT3], ['given_name', 'family_name', 'address/locality'], TENANT]);
    });
  });
  after(async () => { await cell?.close(); });

  const officer = `staff-${randomUUID()}`;
  const citizen = `citizen-${randomUUID()}`;
  const staffToken = () => cell.sign(officer, { tenantId: TENANT });
  const http = async (method: string, path: string, token?: string, json?: unknown) => {
    const res = await fetch(cell.base + path, { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(json ? { 'content-type': 'application/json' } : {}) },
      body: json ? JSON.stringify(json) : undefined });
    const text = await res.text();
    let body: any = text;
    try { body = JSON.parse(text); } catch { /* not JSON */ }
    return { status: res.status, body };
  };
  /** A presentation request; its nonce and state from the signed request object, as a wallet reads them. */
  const ask = async (vct: string, claims = ['given_name']) => {
    const r = await http('POST', '/v1/oid4vp/requests', await staffToken(), { client_id: VERIFIER, vct, claims });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const obj = await fetch(`${cell.base}/v1/oid4vp/requests/${r.body.request_id}/object`);
    const { payload } = peekJws(await obj.text());
    return { id: r.body.request_id as string, nonce: payload.nonce as string, state: payload.state as string };
  };
  type Req = Awaited<ReturnType<typeof ask>>;
  const viaVerify = async (q: Req, presentation: unknown) => {
    const r = await http('POST', '/v1/verify', await staffToken(), { request_id: q.id, presentation });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body as { status: string; reason?: string };
  };
  const viaDirectPost = async (q: Req, presentation: unknown) => {
    const r = await fetch(`${cell.base}/v1/oid4vp/responses`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ vp_token: JSON.stringify({ credential: [presentation] }), state: q.state }).toString() });
    assert.equal(r.status, 200, await r.text());
    return (await http('GET', `/v1/oid4vp/requests/${q.id}`, await staffToken())).body as { status: string; reason?: string };
  };

  const now = () => Math.floor(Date.now() / 1000);
  const claims = { given_name: 'Synthetic', family_name: 'Person', birthdate: '1990-01-01', address: { locality: 'Sfax', country: 'TN' } };
  const sd = ['given_name', 'family_name', 'birthdate', 'address/locality'];
  const issue = (o: { signer?: ReturnType<typeof softwareKey>; iss?: string; vct?: string; exp?: number; nbf?: number; status?: { status_list: { idx: number; uri: string } } } = {}) =>
    issueCredential(o.signer ?? testSigner, { iss: o.iss ?? TEST_ISSUER, vct: o.vct ?? VCT2, holderJwk: holderKey.publicJwk, exp: o.exp ?? now() + 86400,
      ...(o.nbf ? { nbf: o.nbf } : {}), ...(o.status ? { status: o.status } : {}), claims, selectivelyDisclosable: sd });
  const disclose = (c: Issued, names = ['given_name']) => c.disclosures.filter((d) => names.includes(d.path)).map((d) => d.encoded);
  const vpFor = (c: Issued, q: Req, o: { key?: ReturnType<typeof softwareKey> | null; aud?: string; nonce?: string; iat?: number; names?: string[] } = {}) =>
    present(c.sdJwt, disclose(c, o.names), o.key === undefined ? holderKey : o.key, { aud: o.aud ?? VERIFIER, nonce: o.nonce ?? q.nonce, ...(o.iat ? { iat: o.iat } : {}) });

  /** A credential of the cell's own issuer, held by the holder library (with its status-list entry). */
  const heldCredential = async () => {
    const store = new MemoryCredentialStore();
    const holder = new Holder({ fetch: mappedFetch(cell.base), keys: new MemoryKeyStore(), store });
    const requests = new PresentationRequests({ fetch: mappedFetch(cell.base), store, holder,
      registry: async (clientId) => (await http('GET', `/v1/oid4vp/verifiers/${encodeURIComponent(clientId)}`)).body });
    const o = await http('POST', '/v1/issuers/demo-civil-registry/credential-offers', await cell.sign(citizen), { credential_configuration_id: 'residence-certificate-1' });
    assert.equal(o.status, 201, JSON.stringify(o.body));
    const held = await holder.accept(o.body.offer_uri, o.body.tx_code);
    const issued = (await cell.admin.query('select id from wallet.issued_credential where status_idx = $1 and status_list_id = $2',
      [held.status!.idx, held.status!.uri.split('/').pop()])).rows[0].id as string;
    const vp = async () => {
      const r = await http('POST', '/v1/oid4vp/requests', await staffToken(), { client_id: VERIFIER, vct: VCT, claims: ['given_name'] });
      const req = await requests.read(r.body.authorization_request);
      return { q: { id: r.body.request_id as string, nonce: req.nonce, state: req.state }, vp: await requests.presentation(req, held.id) };
    };
    return { issued, vp, status: held.status! };
  };

  it('the matrix: each case refused with its reason, through /v1/verify and through direct_post alike; the control is accepted', async () => {
    const valid = await issue();
    const t = now();
    // [name, the type the request asks for, the presentation for that request, the reason expected]
    const cases: [string, string, (q: Req) => Promise<unknown>, string | typeof ANY][] = [
      ['control: a valid presentation', VCT2, (q) => vpFor(valid, q), 'accepted'],
      ['expired', VCT2, async (q) => vpFor(await issue({ exp: t - 3600 }), q), 'expired'],
      ['not yet valid', VCT2, async (q) => vpFor(await issue({ nbf: t + 3600 }), q), 'not-yet-valid'],
      ['issuer signature altered', VCT2, async (q) => { const v = await vpFor(valid, q); const [jwt, ...rest] = v.split('~'); return [lastSeg(jwt!, (s) => s.slice(0, 5) + (s[5] === 'A' ? 'B' : 'A') + s.slice(6)), ...rest].join('~'); }, 'signature'],
      ['payload altered (a claim in clear changed), signature kept', VCT2, async (q) => {
        const v = await vpFor(valid, q); const [jwt, ...rest] = v.split('~'); const [h, p, s] = jwt!.split('.');
        const payload = JSON.parse(Buffer.from(p!, 'base64url').toString()); payload.address.country = 'XX';
        return [`${h}.${b64u(JSON.stringify(payload))}.${s}`, ...rest].join('~');
      }, 'signature'],
      ['a disclosure value changed', VCT2, async (q) => {
        const v = await vpFor(valid, q); const parts = v.split('~'); const d = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString()); d[2] = 'Changed';
        parts[1] = b64u(JSON.stringify(d)); return parts.join('~');
      }, ANY],
      ['a disclosure that is not in the credential', VCT2, async (q) => { const v = await vpFor(valid, q); const parts = v.split('~'); parts.splice(1, 0, b64u(JSON.stringify(['salt-x', 'given_name', 'Intruder']))); return parts.join('~'); }, ANY],
      ['issuer signature encoded non-canonically (same bytes)', VCT2, async (q) => { const v = await vpFor(valid, q); const [jwt, ...rest] = v.split('~'); return [lastSeg(jwt!, nonCanonical), ...rest].join('~'); }, 'malformed'],
      ['key-binding signature encoded non-canonically (same bytes)', VCT2, async (q) => { const v = await vpFor(valid, q); const parts = v.split('~'); parts[parts.length - 1] = lastSeg(parts.at(-1)!, nonCanonical); return parts.join('~'); }, 'malformed'],
      ['alg none', VCT2, async (q) => { const v = await vpFor(valid, q); const [jwt, ...rest] = v.split('~'); const [h, p] = jwt!.split('.');
        return [`${b64u(JSON.stringify({ ...JSON.parse(Buffer.from(h!, 'base64url').toString()), alg: 'none' }))}.${p}.`, ...rest].join('~'); }, 'signature'],
      ['signed by another key under the issuer\'s kid', VCT2, async (q) => vpFor(await issue({ signer: softwareKey({ kid: 'test-signer-1' }) }), q), 'signature'],
      ['an issuer key id the cell does not know', VCT2, async (q) => vpFor(await issue({ signer: softwareKey({ kid: 'test-signer-9' }) }), q), 'signature'],
      ['an issuer the cell does not trust', VCT2, async (q) => vpFor(await issue({ signer: softwareKey({ kid: 'x' }), iss: `${PUBLIC}/issuers/unknown` }), q), 'issuer-untrusted'],
      ['a trusted issuer minting another issuer\'s type', VCT, async (q) => vpFor(await issue({ vct: VCT }), q), 'issuer-untrusted'],
      ['another credential type than asked', VCT2, async (q) => vpFor(await issue({ vct: VCT2B }), q), 'wrong-type'],
      ['no key binding', VCT2, (q) => vpFor(valid, q, { key: null }), 'key-binding'],
      ['key binding for another verifier', VCT2, (q) => vpFor(valid, q, { aud: 'x509_san_dns:another-verifier.invalid' }), 'key-binding'],
      ['key binding for another nonce (a presentation replayed from another request)', VCT2, (q) => vpFor(valid, q, { nonce: `${q.nonce.slice(0, -2)}AA` }), 'key-binding'],
      ['key binding signed by another key than the credential\'s (cnf)', VCT2, (q) => vpFor(valid, q, { key: otherKey }), 'signature'],
      ['key binding made an hour ago', VCT2, (q) => vpFor(valid, q, { iat: t - 3600 }), 'key-binding'],
      ['fewer claims disclosed than asked', VCT2, (q) => vpFor(valid, q, { names: ['family_name'] }), 'missing-claims'],
      ['a status list the cell cannot read', VCT2, async (q) => vpFor(await issue({ status: { status_list: { idx: 3, uri: 'https://status.unreachable.invalid/lists/1' } } }), q), 'status-unavailable'],
      ['not a string', VCT2, async () => ({ vp: 'x' }), 'malformed'],
      ['empty', VCT2, async () => '', 'malformed'],
      ['too large', VCT2, async (q) => `${await vpFor(valid, q)}${'A'.repeat(40_000)}`, 'malformed'],
    ];
    const rows: string[] = [];
    for (const [name, vct, make, expected] of cases) {
      for (const [route, send] of [['verify', viaVerify], ['direct_post', viaDirectPost]] as const) {
        const q = await ask(vct);
        const out = await send(q, await make(q));
        const got = out.status === 'accepted' ? 'accepted' : out.reason;
        if (expected === 'accepted') assert.equal(out.status, 'accepted', `${name} (${route})`);
        else {
          assert.equal(out.status, 'rejected', `${name} (${route}): ${JSON.stringify(out)}`);
          if (expected !== ANY) assert.equal(out.reason, expected, `${name} (${route})`);
        }
        rows.push(`${route}\t${name}\t${got}`);
      }
    }
    if (process.env.E2E_LOG) console.log(rows.join('\n'));
    assert.equal(rows.length, cases.length * 2);
  });

  it('status: revoked, suspended, and an issuer that is suspended by the cell; a status list of another issuer', async () => {
    const h = await heldCredential();
    for (const route of [viaVerify, viaDirectPost]) {
      await cell.admin.query("select wallet.set_credential_status($1, 'suspended', 'under-review', 'staff:check')", [h.issued]);
      let { q, vp } = await h.vp();
      assert.deepEqual(await route(q, vp), { status: 'rejected', reason: 'suspended' });
      await cell.admin.query("select wallet.set_credential_status($1, 'valid', 'review-cleared', 'staff:check')", [h.issued]);
      ({ q, vp } = await h.vp());
      assert.equal((await route(q, vp)).status, 'accepted');
    }
    await cell.admin.query("select wallet.set_credential_status($1, 'revoked', 'lost-device', 'holder:self')", [h.issued]);
    for (const route of [viaVerify, viaDirectPost]) {
      const { q, vp } = await h.vp();
      assert.deepEqual(await route(q, vp), { status: 'rejected', reason: 'revoked' });
    }
    // A credential of the test issuer pointing at the cell issuer's status list: the list is signed by another key.
    for (const route of [viaVerify, viaDirectPost]) {
      const q = await ask(VCT2);
      const forged = await issue({ status: { status_list: { idx: h.status.idx + 1, uri: h.status.uri } } });
      const out = await route(q, await vpFor(forged, q));
      assert.equal(out.status, 'rejected', JSON.stringify(out));
    }
    // An issuer the cell has suspended: its credentials are refused while it is.
    const c = await issue({ signer: heldSigner, iss: HELD_ISSUER, vct: VCT3 });
    let q = await ask(VCT3);
    assert.equal((await viaVerify(q, await vpFor(c, q))).status, 'accepted');
    await cell.admin.query("update wallet.issuer set status = 'suspended' where id = $1", [heldIssuerId]);
    for (const route of [viaVerify, viaDirectPost]) {
      q = await ask(VCT3);
      assert.deepEqual(await route(q, await vpFor(c, q)), { status: 'rejected', reason: 'issuer-untrusted' });
    }
  });

  it(`API fuzzing: ${API_CASES} seeded mutations (seed ${SEED}) posted to /v1/verify are all refused, none is a server error; garbage forms to direct_post are 400`, async () => {
    const valid = await issue();
    const rand = prng(SEED);
    const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.~';
    const mutate: ((vp: string) => string)[] = [
      (vp) => { const i = Math.floor(rand() * vp.length); return vp.slice(0, i) + A[Math.floor(rand() * A.length)] + vp.slice(i + 1); },
      (vp) => { const i = Math.floor(rand() * vp.length); return vp.slice(0, i) + vp.slice(i + 1); },
      (vp) => vp.slice(0, Math.floor(rand() * (vp.length - 1))),
      (vp) => { const p = vp.split('~'); p.splice(1 + Math.floor(rand() * (p.length - 2)), 1); return p.join('~'); },
      (vp) => { const p = vp.split('~'); p.splice(1, 0, p[1]!); return p.join('~'); },
      (vp) => vp.split('~').reverse().join('~'),
      (vp) => vp.replace(/\./g, () => (rand() < 0.5 ? '.' : '~')),
      (vp) => Buffer.from(vp).toString('base64url'),
    ];
    const reasons = new Map<string, number>();
    let changed = 0;
    for (let n = 0; n < API_CASES; n++) {
      const q = await ask(VCT2);
      const vp = await vpFor(valid, q);
      const input = mutate[n % mutate.length]!(vp);
      if (input === vp) continue;
      changed++;
      const r = await http('POST', '/v1/verify', await staffToken(), { request_id: q.id, presentation: input });
      assert.equal(r.status, 200, `seed ${SEED} case ${n}: HTTP ${r.status} ${JSON.stringify(r.body)}`);
      assert.equal(r.body.status, 'rejected', `seed ${SEED} case ${n}: ${JSON.stringify(r.body)}`);
      reasons.set(r.body.reason, (reasons.get(r.body.reason) ?? 0) + 1);
    }
    assert.ok(changed >= API_CASES * 0.95);
    assert.ok([...reasons.keys()].every((k) => ['malformed', 'signature', 'key-binding', 'missing-claims', 'issuer-untrusted', 'wrong-type'].includes(k)), JSON.stringify([...reasons]));
    // direct_post with what a broken or hostile wallet might send: refused, never a server error.
    const forms = [
      {}, { state: 'x' }, { state: 'A'.repeat(43) }, { state: ['a', 'b'] }, { vp_token: 'x' },
    ];
    for (const f of forms) {
      const r = await fetch(`${cell.base}/v1/oid4vp/responses`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(f) });
      assert.equal(r.status, 400, JSON.stringify(f));
    }
    for (const vpToken of ['', 'null', '[]', '{}', '{"credential":[]}', '{"credential":["a","b"]}', '{"credential":[1]}', '{"other":["x"]}', '{'.repeat(10_000)]) {
      const q = await ask(VCT2);
      const r = await fetch(`${cell.base}/v1/oid4vp/responses`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ vp_token: vpToken, state: q.state }).toString() });
      assert.equal(r.status, 200, vpToken.slice(0, 40));
      const out = (await http('GET', `/v1/oid4vp/requests/${q.id}`, await staffToken())).body;
      assert.deepEqual(out, { status: 'rejected', reason: 'malformed' }, vpToken.slice(0, 40));
    }
    // Every refusal is in the presentation log, with no claim value.
    const log = (await cell.admin.query("select count(*)::int as n, bool_and(disclosed_claims = '{}') as none from wallet.presentation_log where result = 'rejected'")).rows[0];
    assert.ok(log.n >= changed && log.none, JSON.stringify(log));
  });
});
