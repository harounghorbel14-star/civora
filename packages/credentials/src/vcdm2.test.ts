import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { supportedFormat } from './formats';
import { CredentialError } from './jws';
import { softwareKey } from './keys';
import { present } from './sd-jwt';
import { issueCredential, verifyCredential } from './sd-jwt-vc';
import { CIVORA_CLAIMS_CONTEXT, toVcdm2, VCDM2_BASE_CONTEXT, vcdm2TypeName } from './vcdm2';

const CTX_URL = 'https://wallet.civora-cell.invalid/v1/contexts/civora-claims-v1.jsonld';
const fails = (f: () => unknown, re: RegExp) => assert.throws(f, (e: unknown) => e instanceof CredentialError && re.test(e.message));

describe('W3C VC Data Model 2.0 view of a verified SD-JWT VC (P4-A3)', () => {
  it('issue → present → verify → VCDM 2.0: base context first, type, issuer, validity, only the disclosed claims', async () => {
    const issuer = softwareKey({ kid: 'demo-1' });
    const holder = softwareKey();
    const vct = 'urn:civora:tn:synthetic:residence-certificate:1';
    const issued = await issueCredential(issuer, {
      iss: 'https://wallet.civora-cell.invalid/issuers/demo-civil-registry', vct, holderJwk: holder.publicJwk, iat: 1_893_456_000, exp: 1_924_992_000,
      claims: { given_name: 'Amina', family_name: 'Ben Salah', given_name_ar: 'أمينة', birthdate: '1990-04-12', address: { locality: 'Sfax', country: 'TN' }, document_number: 'SYN-0001' },
      selectivelyDisclosable: ['given_name', 'family_name', 'given_name_ar', 'birthdate', 'address/locality', 'document_number'],
    });
    const kb = { aud: 'x509_san_dns:verifier.example.invalid', nonce: 'nonce-vcdm2-1234567890' };
    const chosen = issued.disclosures.filter((d) => ['given_name', 'given_name_ar', 'address/locality'].includes(d.path)).map((d) => d.encoded);
    const v = await verifyCredential(await present(issued.sdJwt, chosen, holder, { ...kb, iat: 1_900_000_000 }), { issuerKey: async () => issuer.publicJwk, keyBinding: kb, acceptedVct: [vct], now: 1_900_000_000 });
    const doc = toVcdm2(v, CTX_URL);
    assert.deepEqual(doc, {
      '@context': [VCDM2_BASE_CONTEXT, CTX_URL],
      type: ['VerifiableCredential', 'ResidenceCertificate'],
      issuer: 'https://wallet.civora-cell.invalid/issuers/demo-civil-registry',
      validFrom: '2030-01-01T00:00:00Z',
      validUntil: '2031-01-01T00:00:00Z',
      credentialSubject: { given_name: 'Amina', given_name_ar: 'أمينة', address: { locality: 'Sfax', country: 'TN' } },
    });
    const text = JSON.stringify(doc);
    for (const hidden of ['Ben Salah', '1990-04-12', 'SYN-0001', 'cnf', '_sd', 'vct']) assert.ok(!text.includes(hidden), `${hidden} is not in the view`);
  });

  it('VCDM 2.0 rules the view keeps: @context starts with the base context; type has VerifiableCredential; issuer is a URL; dates are dateTimeStamps', () => {
    const doc = toVcdm2({ iss: 'https://i.invalid', vct: 'urn:civora:tn:synthetic:test-type:2', claims: { nbf: 1_900_000_000, exp: 1_900_086_400, iat: 1, family_name: 'X' } }, CTX_URL);
    assert.equal((doc['@context'] as string[])[0], 'https://www.w3.org/ns/credentials/v2');
    assert.ok((doc.type as string[]).includes('VerifiableCredential'));
    assert.match(doc.issuer as string, /^https:\/\//);
    assert.equal(doc.validFrom, '2030-03-17T17:46:40Z', 'nbf, when present, is the start of validity');
    for (const k of ['validFrom', 'validUntil']) assert.match(doc[k] as string, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    assert.equal(doc.id, undefined, 'no credential identifier (it would make presentations linkable)');
    assert.equal(doc.proof, undefined, 'a view, not a secured credential');
  });

  it('a claim without a term in the context is refused, not mapped to the issuer-dependent vocabulary; bad inputs refused', () => {
    fails(() => toVcdm2({ iss: 'https://i.invalid', vct: 'urn:civora:tn:synthetic:t:1', claims: { iat: 1, nickname: 'x' } }, CTX_URL), /nickname has no term/);
    fails(() => toVcdm2({ iss: 'https://i.invalid', vct: 'urn:civora:tn:synthetic:t:1', claims: { iat: 1, address: { street: 'x' } } }, CTX_URL), /address\/street has no term/);
    fails(() => toVcdm2({ iss: 'https://i.invalid', vct: 'urn:civora:tn:synthetic:t:1', claims: { iat: 1 } }, 'http://insecure.invalid/c'), /https/);
    fails(() => toVcdm2({ iss: 'https://i.invalid', vct: 'urn:other:x', claims: { iat: 1 } }, CTX_URL), /not a CIVORA credential type/);
    fails(() => toVcdm2({ iss: 'https://i.invalid', vct: 'urn:civora:tn:synthetic:t:1', claims: { iat: 'yesterday' } }, CTX_URL), /iat is not a NumericDate/);
    assert.equal(vcdm2TypeName('urn:civora:tn:synthetic:residence-certificate:1'), 'ResidenceCertificate');
  });

  it('the context: JSON-LD 1.1, protected terms, every term an absolute IRI (or a compact IRI of a declared prefix)', () => {
    const ctx = CIVORA_CLAIMS_CONTEXT['@context'] as Record<string, unknown>;
    assert.equal(ctx['@version'], 1.1);
    assert.equal(ctx['@protected'], true);
    const iri = (x: unknown) => typeof x === 'string' && (/^https?:\/\/|^urn:/.test(x) || /^(civora|xsd):/.test(x));
    const check = (c: Record<string, unknown>) => {
      for (const [k, def] of Object.entries(c)) {
        if (k.startsWith('@')) continue;
        const id = typeof def === 'string' ? def : (def as Record<string, unknown>)['@id'];
        assert.ok(iri(id), `${k} → ${String(id)}`);
        const inner = typeof def === 'object' ? (def as Record<string, unknown>)['@context'] : undefined;
        if (inner) check(inner as Record<string, unknown>);
      }
    };
    check(ctx);
  });
});

describe('credential formats (P4-A4): one registry; mso_mdoc planned', () => {
  it('dc+sd-jwt is supported; mso_mdoc is refused as planned (ISO/IEC 18013-5); anything else is unknown', () => {
    assert.equal(supportedFormat('dc+sd-jwt'), 'dc+sd-jwt');
    fails(() => supportedFormat('mso_mdoc'), /mso_mdoc .*18013-5.* is planned, not supported/);
    for (const f of ['jwt_vc_json', 'ldp_vc', 'vc+sd-jwt', '', undefined, 7, 'toString', '__proto__']) fails(() => supportedFormat(f), /unknown credential format/);
  });
});
