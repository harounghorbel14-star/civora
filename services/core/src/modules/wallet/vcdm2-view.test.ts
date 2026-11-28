import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { CIVORA_CLAIMS_CONTEXT_PATH, toVcdm2 } from '@civora/credentials';
import { DemoClaimSource } from './demo-source';

/** Every claim the demo issuers can put in a credential has a term in the CIVORA context (P4-A3; doc phase-4/08). */
describe('the W3C VC 2.0 view covers every claim of the demo issuers', () => {
  it('all claim paths of the demo source map, with schema.org terms; nothing falls to the issuer-dependent vocabulary', async () => {
    const paths = ['given_name', 'family_name', 'given_name_ar', 'family_name_ar', 'birthdate', 'address', 'address/locality', 'address/country', 'document_number'];
    const claims = await new DemoClaimSource().claimsFor('8b1f7c2e-5d4a-4f3b-9e2d-1c0b9a8f7e6d', 'urn:civora:tn:synthetic:residence-certificate:1', paths);
    const doc = toVcdm2({ iss: 'https://wallet.civora-cell.invalid/issuers/demo-civil-registry', vct: 'urn:civora:tn:synthetic:residence-certificate:1',
      claims: { ...claims, iat: 1_900_000_000, exp: 1_931_536_000 } }, `https://wallet.civora-cell.invalid${CIVORA_CLAIMS_CONTEXT_PATH}`);
    assert.deepEqual(Object.keys(doc.credentialSubject as object).sort(), ['address', 'birthdate', 'document_number', 'family_name', 'family_name_ar', 'given_name', 'given_name_ar']);
  });
});
