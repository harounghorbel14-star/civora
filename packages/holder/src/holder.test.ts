import { strict as assert } from 'node:assert';
import { randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';
import { CredentialError } from '@civora/credentials';
import { backupKeyId, decryptBackup, encryptBackup, Holder, MemoryCredentialStore, MemoryKeyStore, parseOffer, PRE_AUTH_GRANT, wellKnown } from './holder';

const offerUri = (o: unknown) => `openid-credential-offer://?credential_offer=${encodeURIComponent(JSON.stringify(o))}`;
const good = {
  credential_issuer: 'https://wallet.civora-cell.invalid/issuers/demo-civil-registry',
  credential_configuration_ids: ['residence-certificate-1'],
  grants: { [PRE_AUTH_GRANT]: { 'pre-authorized_code': 'c'.repeat(43), tx_code: { input_mode: 'numeric', length: 6 } } },
};
const refused = (f: () => unknown) => assert.throws(f, (e: unknown) => e instanceof CredentialError && e.code === 'offer');

describe('holder library (P4-D2): offers, well-known URIs, encrypted backups', () => {
  it('parses an offer by value, and refuses what it does not support rather than guessing', () => {
    const o = parseOffer(offerUri(good));
    assert.equal(o.issuer, good.credential_issuer);
    assert.equal(o.txCode?.length, 6);
    refused(() => parseOffer(offerUri({ ...good, credential_issuer: 'http://wallet.civora-cell.invalid/issuers/x' })));
    refused(() => parseOffer(offerUri({ ...good, grants: { authorization_code: {} } })));
    refused(() => parseOffer(offerUri({ ...good, credential_configuration_ids: [] })));
    refused(() => parseOffer('openid-credential-offer://?credential_offer_uri=https%3A%2F%2Fevil.invalid%2Fo'));
    refused(() => parseOffer('https://wallet.civora-cell.invalid/offer'));
    refused(() => parseOffer('openid-credential-offer://?credential_offer=%7Bnot-json'));
    refused(() => parseOffer(`openid-credential-offer://?credential_offer=${'a'.repeat(9000)}`));
  });

  it('an issuer that offers a planned format (mso_mdoc, ISO/IEC 18013-5) is refused before anything is requested (P4-A4)', async () => {
    const calls: string[] = [];
    const mdl = { ...good, credential_configuration_ids: ['mdl-1'] };
    const holder = new Holder({
      keys: new MemoryKeyStore(), store: new MemoryCredentialStore(),
      fetch: async (url) => {
        calls.push(url);
        return { status: 200, text: async () => JSON.stringify({ credential_issuer: good.credential_issuer,
          credential_configurations_supported: { 'mdl-1': { format: 'mso_mdoc', doctype: 'org.iso.18013.5.1.mDL' } } }) };
      },
    });
    await assert.rejects(holder.accept(offerUri(mdl), '123456'), (e: unknown) => e instanceof CredentialError && e.code === 'format' && /planned/.test(e.message));
    assert.deepEqual(calls, ['https://wallet.civora-cell.invalid/.well-known/openid-credential-issuer/issuers/demo-civil-registry'], 'only the metadata was read');
  });

  it('builds path-based well-known URIs (RFC 8615, OpenID4VCI §12.2.2)', () => {
    assert.equal(wellKnown('https://w.invalid/issuers/a', 'openid-credential-issuer'), 'https://w.invalid/.well-known/openid-credential-issuer/issuers/a');
    assert.equal(wellKnown('https://w.invalid', 'jwt-vc-issuer'), 'https://w.invalid/.well-known/jwt-vc-issuer');
  });

  it('backups: AES-256-GCM, open only with the right key and unaltered; the key id reveals nothing and is stable', () => {
    const key = randomBytes(32);
    const blob = encryptBackup(key, '{"sdJwt":"x~y~"}');
    assert.ok(blob.length >= 29);
    assert.equal(decryptBackup(key, blob), '{"sdJwt":"x~y~"}');
    assert.notDeepEqual(encryptBackup(key, 'same'), encryptBackup(key, 'same'), 'a fresh IV each time');
    assert.throws(() => decryptBackup(randomBytes(32), blob), CredentialError);
    const altered = Buffer.from(blob);
    altered[14] = altered[14]! ^ 1;
    assert.throws(() => decryptBackup(key, altered), CredentialError);
    assert.throws(() => encryptBackup(randomBytes(16), 'x'), CredentialError);
    assert.match(backupKeyId(key), /^[A-Za-z0-9_-]{43}$/);
    assert.equal(backupKeyId(key), backupKeyId(Buffer.from(key)));
    assert.notEqual(backupKeyId(key), backupKeyId(randomBytes(32)));
  });
});
