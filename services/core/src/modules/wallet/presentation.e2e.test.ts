import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { CredentialError } from '@civora/credentials';
import { Holder, MemoryCredentialStore, MemoryKeyStore, PresentationRequests } from '@civora/holder';
import { display, hsmInstalled, mappedFetch, PUBLIC, startWalletCell, type WalletCell } from './testkit.test.helper';

/**
 * Phase 4 week 4, end to end: issue → hold → present → verify → revoke (P4-AC1) through the OpenID4VP verifier of the
 * cell (P4-API4, P4-API5), with the holder library as the wallet and both issuer and verifier keys in SoftHSM.
 * Also the rejections of P4-AC2 that need the verifier: revoked, suspended, wrong verifier or nonce, replayed answer,
 * untrusted issuer, missing claims; and the authorisation of staff (Q4-3). Needs TEST_DATABASE_URL and SoftHSM.
 */
const adminUrl = process.env.TEST_DATABASE_URL;
const required = process.env.CIVORA_HSM_TESTS === 'required';
const skip = !adminUrl ? 'TEST_DATABASE_URL not set' : !hsmInstalled && !required ? 'SoftHSM 2 and OpenSC are not installed (CI requires them)' : false;
const ISSUER = `${PUBLIC}/issuers/demo-civil-registry`;
const VCT = 'urn:civora:tn:synthetic:residence-certificate:1';
const VERIFIER = 'verifier.demo-bank.civora-cell.invalid';
const TENANT = randomUUID();
const OTHER_TENANT = randomUUID();

describe('OpenID4VP verification, end to end (Phase 4 week 4)', { skip }, () => {
  let cell: WalletCell;
  before(async () => {
    assert.ok(hsmInstalled, 'softhsm2 and opensc must be installed when CIVORA_HSM_TESTS=required');
    cell = await startWalletCell(adminUrl!, async (admin, ceremony) => {
      const issuerJwk = ceremony('01', 'demo-civil-registry-1');
      const issuerId = (await admin.query('select wallet.register_issuer($1,$2,$3,$4,$5,$6,$7) as id',
        ['demo-civil-registry', ISSUER, display('Demo civil registry'), 'demo-civil-registry-1', issuerJwk, 'civora-wallet', '01'])).rows[0].id;
      await admin.query('select wallet.register_credential_type($1,$2,$3,$4,$5,$6,$7,$8)',
        [issuerId, VCT, display('Residence certificate (demo)'), ['given_name', 'family_name', 'birthdate', 'address', 'address/locality', 'address/country'],
          ['given_name', 'family_name', 'birthdate', 'address/locality'], 365, 'residence-certificate', [30, 7]]);
      const verifierJwk = ceremony('02', 'demo-bank-verifier-1');
      await admin.query('select wallet.register_verifier($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [VERIFIER, display('Demo bank (verifier)'), verifierJwk, 'demo-bank-verifier-1', 'civora-wallet', '02', [VCT], ['given_name', 'family_name', 'address/locality'], TENANT]);
    });
  });
  after(async () => { await cell?.close(); });

  const http = async (method: string, path: string, token?: string, json?: unknown) => {
    const res = await fetch(cell.base + path, { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(json ? { 'content-type': 'application/json' } : {}) },
      body: json ? JSON.stringify(json) : undefined });
    const text = await res.text();
    let body: any = text;
    try { body = JSON.parse(text); } catch { /* not JSON */ }
    return { status: res.status, body };
  };
  const citizen = `citizen-${randomUUID()}`;
  const officer = `staff-${randomUUID()}`;
  const staffToken = () => cell.sign(officer, { tenantId: TENANT });
  const wallet = () => {
    const store = new MemoryCredentialStore();
    const holder = new Holder({ fetch: mappedFetch(cell.base), keys: new MemoryKeyStore(), store });
    const requests = new PresentationRequests({
      fetch: mappedFetch(cell.base), store, holder,
      registry: async (clientId) => (await http('GET', `/v1/oid4vp/verifiers/${encodeURIComponent(clientId)}`)).body,
    });
    return { holder, requests, store };
  };
  const obtain = async (h: Holder) => {
    const o = await http('POST', '/v1/issuers/demo-civil-registry/credential-offers', await cell.sign(citizen), { credential_configuration_id: 'residence-certificate-1' });
    assert.equal(o.status, 201, JSON.stringify(o.body));
    return h.accept(o.body.offer_uri, o.body.tx_code);
  };
  const ask = async (claims = ['given_name', 'address/locality']) => {
    const r = await http('POST', '/v1/oid4vp/requests', await staffToken(), { client_id: VERIFIER, vct: VCT, claims });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    return r.body as { request_id: string; authorization_request: string; request_uri: string };
  };
  const outcome = async (id: string) => (await http('GET', `/v1/oid4vp/requests/${id}`, await staffToken())).body;

  it('AC1: issue → hold → present (cross-device, direct_post) → verify: only the requested claims reach the verifier, once; the log has claim names only', async () => {
    const w = wallet();
    const held = await obtain(w.holder);
    const q = await ask();
    assert.ok(!/given_name|locality/.test(decodeURIComponent(q.authorization_request)), 'the QR holds no claim names or personal data (P4-SEC4)');
    assert.deepEqual(await outcome(q.request_id), { status: 'pending' });
    const req = await w.requests.read(q.authorization_request);
    assert.equal(req.clientId, VERIFIER);
    assert.equal(req.verifierName.en, 'Demo bank (verifier)');
    assert.deepEqual(req.claims, ['given_name', 'address/locality']);
    assert.deepEqual(req.candidates.map((c) => c.id), [held.id]);
    assert.equal(await w.requests.answer(req, held.id), 200);
    const all = await w.holder.claims(held.id);
    const first = await outcome(q.request_id);
    assert.equal(first.status, 'accepted');
    assert.deepEqual(first.claims, { given_name: all.given_name, address: { locality: (all.address as { locality: string }).locality } });
    assert.equal(first.claims.family_name, undefined);
    assert.deepEqual(await outcome(q.request_id), { status: 'accepted' }, 'the claims are handed over once');
    const log = (await cell.admin.query('select result, reason, credential_types, disclosed_claims from wallet.presentation_log where request_id = $1', [q.request_id])).rows;
    assert.deepEqual(log, [{ result: 'accepted', reason: null, credential_types: [VCT], disclosed_claims: ['given_name', 'address/locality'] }]);
    assert.ok(!JSON.stringify(log).includes(String(all.given_name)), 'no claim value in the log');
    assert.equal(await w.requests.answer(req, held.id), 400, 'an answer works once (state)');
  });

  it('AC1 revoke, and AC2 at the verifier: revoked, suspended, then reinstated; a presentation for another verifier or nonce; missing claims', async () => {
    const w = wallet();
    const held = await obtain(w.holder);
    const issued = (await cell.admin.query('select id from wallet.issued_credential where status_idx = $1 and status_list_id = $2',
      [held.status!.idx, held.status!.uri.split('/').pop()])).rows[0].id;
    const answerWith = async (claims?: string[]) => { const q = await ask(claims); const req = await w.requests.read(q.authorization_request); await w.requests.answer(req, held.id); return outcome(q.request_id); };

    await cell.admin.query("select wallet.set_credential_status($1, 'suspended', 'under-review', 'staff:check')", [issued]);
    assert.deepEqual(await answerWith(), { status: 'rejected', reason: 'suspended' });
    await cell.admin.query("select wallet.set_credential_status($1, 'valid', 'review-cleared', 'staff:check')", [issued]);
    assert.equal((await answerWith()).status, 'accepted');
    await cell.admin.query("select wallet.set_credential_status($1, 'revoked', 'holder-request', 'holder:self')", [issued]);
    assert.deepEqual(await answerWith(), { status: 'rejected', reason: 'revoked' });

    const w2 = wallet();
    const held2 = await obtain(w2.holder);
    // A presentation made for another verifier (or another nonce), posted with this request's state.
    const q = await ask();
    const req = await w2.requests.read(q.authorization_request);
    const forged = { ...req, clientId: 'another-verifier.invalid' };
    const vp = await w2.holder.present(held2.id, req.claims, { aud: forged.clientId, nonce: req.nonce });
    const r = await fetch(`${cell.base}/v1/oid4vp/responses`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ vp_token: JSON.stringify({ credential: [vp] }), state: req.state }).toString() });
    assert.equal(r.status, 200);
    assert.deepEqual(await outcome(q.request_id), { status: 'rejected', reason: 'key-binding' });
    // The holder discloses less than asked: missing claims.
    const q2 = await ask(['given_name', 'family_name']);
    const req2 = await w2.requests.read(q2.authorization_request);
    const partial = await w2.holder.present(held2.id, ['given_name'], { aud: VERIFIER, nonce: req2.nonce });
    await fetch(`${cell.base}/v1/oid4vp/responses`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ vp_token: JSON.stringify({ credential: [partial] }), state: req2.state }).toString() });
    assert.deepEqual(await outcome(q2.request_id), { status: 'rejected', reason: 'missing-claims' });
  });

  it('revocation on request (P4-F5): the holder revokes after a fresh sign-in; the issuer\'s officers suspend and reinstate; the verifier sees each', async () => {
    const w = wallet();
    const held = await obtain(w.holder);
    const answer = async () => { const q = await ask(); const req = await w.requests.read(q.authorization_request); await w.requests.answer(req, held.id); return outcome(q.request_id); };
    const issued = (await cell.admin.query('select id from wallet.issued_credential where status_idx = $1 and status_list_id = $2',
      [held.status!.idx, held.status!.uri.split('/').pop()])).rows[0].id as string;
    const fresh = { auth_time: Math.floor(Date.now() / 1000), acr: '1' };

    // The holder sees the credentials issued to them (no claim values); another citizen does not see them.
    const mine = await http('GET', '/v1/wallet/issued', await cell.sign(citizen));
    assert.equal(mine.status, 200, JSON.stringify(mine.body));
    const entry = (mine.body as { id: string; status: string; vct: string }[]).find((e) => e.id === issued);
    assert.ok(entry && entry.status === 'valid' && entry.vct === VCT);
    assert.deepEqual(Object.keys(entry).sort(), ['expires_at', 'id', 'issued_at', 'issuer', 'status', 'status_changed_at', 'status_reason', 'vct']);
    const stranger = `citizen-${randomUUID()}`;
    assert.ok(!((await http('GET', '/v1/wallet/issued', await cell.sign(stranger))).body as { id: string }[]).some((e) => e.id === issued));

    // Officers: the role and a recent sign-in are required; suspend, then reinstate; reasons must fit the action.
    const officerToken = (roles: string[], extra = fresh) => cell.sign(`staff-${randomUUID()}`, { tenantId: TENANT, roles }, extra);
    assert.equal((await http('GET', `/v1/admin/wallet/issued/${issued}`, await cell.sign(citizen))).status, 403);
    assert.equal((await http('GET', `/v1/admin/wallet/issued/${issued}`, await officerToken([]))).status, 403);
    const looked = await http('GET', `/v1/admin/wallet/issued/${issued}`, await officerToken(['credential-officer']));
    assert.equal(looked.status, 200, JSON.stringify(looked.body));
    assert.ok(!JSON.stringify(looked.body).includes(citizen), 'not the subject');
    const stale = await fetch(`${cell.base}/v1/admin/wallet/issued/${issued}:suspend`, { method: 'POST', headers: { authorization: `Bearer ${await officerToken(['credential-officer'], {} as typeof fresh)}`, 'content-type': 'application/json' }, body: JSON.stringify({ reason: 'under-review' }) });
    assert.equal(stale.status, 401);
    assert.match(stale.headers.get('www-authenticate') ?? '', /insufficient_user_authentication/);
    assert.equal((await http('POST', `/v1/admin/wallet/issued/${issued}:suspend`, await officerToken(['credential-officer']), { reason: 'review-cleared' })).status, 400, 'a reason that does not fit');
    assert.equal((await http('POST', `/v1/admin/wallet/issued/${issued}:suspend`, await officerToken(['credential-officer']), { reason: 'under-review' })).status, 200);
    assert.deepEqual(await answer(), { status: 'rejected', reason: 'suspended' });
    assert.equal((await http('POST', `/v1/admin/wallet/issued/${issued}:reinstate`, await officerToken(['credential-officer']), { reason: 'review-cleared' })).status, 200);
    assert.equal((await answer()).status, 'accepted');

    // The holder: a fresh sign-in is required; another citizen's credential is unknown; revoked once, final.
    assert.equal((await http('POST', `/v1/wallet/issued/${issued}:revoke`, await cell.sign(citizen), { reason: 'lost-device' })).status, 401);
    assert.equal((await http('POST', `/v1/wallet/issued/${issued}:revoke`, await cell.sign(stranger, undefined, fresh), { reason: 'lost-device' })).status, 404);
    assert.equal((await http('POST', `/v1/wallet/issued/${issued}:revoke`, await cell.sign(citizen, undefined, fresh), { reason: 'data-changed' })).status, 400, 'not a holder reason');
    const rev = await http('POST', `/v1/wallet/issued/${issued}:revoke`, await cell.sign(citizen, undefined, fresh), { reason: 'lost-device' });
    assert.equal(rev.status, 200, JSON.stringify(rev.body));
    assert.deepEqual(await answer(), { status: 'rejected', reason: 'revoked' });
    assert.equal((await http('POST', `/v1/wallet/issued/${issued}:revoke`, await cell.sign(citizen, undefined, fresh), { reason: 'lost-device' })).status, 409);
    assert.equal((await http('POST', `/v1/admin/wallet/issued/${issued}:reinstate`, await officerToken(['credential-officer']), { reason: 'review-cleared' })).status, 409, 'revocation is final');
    const history = (await http('GET', `/v1/admin/wallet/issued/${issued}`, await officerToken(['credential-officer']))).body.history as { action: string; by: string }[];
    assert.deepEqual(history.map((h) => `${h.action}:${h.by}`), ['issued:issuer-system', 'suspended:staff', 'reinstated:staff', 'revoked:holder']);
  });

  it('QR presentation (P4-API5): the verifier\'s device scans the holder\'s presentation for its own request', async () => {
    const w = wallet();
    const held = await obtain(w.holder);
    const q = await ask(['address/locality']);
    const req = await w.requests.read(q.authorization_request);
    const vp = await w.requests.presentation(req, held.id);
    const other = await cell.sign(`staff-${randomUUID()}`, { tenantId: TENANT });
    assert.equal((await http('POST', '/v1/verify', other, { request_id: q.request_id, presentation: vp })).status, 404, 'only the staff member who asked');
    const r = await http('POST', '/v1/verify', await staffToken(), { request_id: q.request_id, presentation: vp });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.status, 'accepted');
    assert.equal(typeof r.body.claims.address.locality, 'string');
    assert.equal((await http('POST', '/v1/verify', await staffToken(), { request_id: q.request_id, presentation: vp })).status, 404, 'answered once');
  });

  it('staff authorisation (Q4-3), request objects and the wallet\'s checks', async () => {
    const citizenToken = await cell.sign(citizen);
    assert.equal((await http('POST', '/v1/oid4vp/requests', citizenToken, { client_id: VERIFIER, vct: VCT, claims: ['given_name'] })).status, 403);
    const otherInstitution = await cell.sign(`staff-${randomUUID()}`, { tenantId: OTHER_TENANT });
    assert.equal((await http('POST', '/v1/oid4vp/requests', otherInstitution, { client_id: VERIFIER, vct: VCT, claims: ['given_name'] })).status, 403);
    assert.equal((await http('POST', '/v1/oid4vp/requests', await staffToken(), { client_id: VERIFIER, vct: VCT, claims: ['birthdate'] })).status, 403, 'a claim the verifier is not registered for');
    assert.equal((await http('POST', '/v1/oid4vp/requests', await staffToken(), { client_id: 'unknown.invalid', vct: VCT, claims: ['given_name'] })).status, 404);
    const q = await ask();
    const obj = await fetch(`${cell.base}/v1/oid4vp/requests/${q.request_id}/object`);
    assert.equal(obj.headers.get('content-type'), 'application/oauth-authz-req+jwt');
    const w = wallet();
    // A registry that returns another key: the wallet refuses the request before showing anything.
    const fake = new PresentationRequests({ fetch: mappedFetch(cell.base), store: w.store, holder: w.holder,
      registry: async (clientId) => ({ client_id: clientId, jwks: { keys: [{ ...(await http('GET', `/v1/oid4vp/verifiers/${clientId}`)).body.jwks.keys[0], x: 'f83OJ3D2xF1Bg8vub9tLe1gHMzV76e8Tus9uPHvRVEU' }] } }) });
    await assert.rejects(fake.read(q.authorization_request), CredentialError);
    await assert.rejects(w.requests.read(q.authorization_request.replace('request_uri=https', 'request_uri=http')), CredentialError);
    await assert.rejects(w.requests.read('openid4vp://?client_id=redirect_uri%3Ahttps%3A%2F%2Fevil.invalid&request_uri=https%3A%2F%2Fevil.invalid%2Fr'), CredentialError);
    const unknown = await http('POST', '/v1/oid4vp/responses', undefined, undefined);
    assert.equal(unknown.status, 400);
  });
});
