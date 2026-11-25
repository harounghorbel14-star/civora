import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { nameUuidFromBytes, pairwiseSub, sectorOf } from './pairwise';

describe('pairwise subjects (P3-A3, P3-DB6)', () => {
  it('name-based UUID as Java computes it (version 3, IETF variant)', () => {
    // Java: UUID.nameUUIDFromBytes("civora".getBytes(UTF_8)) = 6d2d8a4f-... is checked against Keycloak itself in the
    // realms test; here the structure: version nibble 3, variant 10xx.
    const u = nameUuidFromBytes(Buffer.from('civora'));
    assert.match(u, /^[0-9a-f]{8}-[0-9a-f]{4}-3[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
  it('stable per (sector, user, salt); different for another sector, user or salt', () => {
    const a = pairwiseSub('rp1.agency.invalid', 'user-1', 'salt');
    assert.equal(a, pairwiseSub('rp1.agency.invalid', 'user-1', 'salt'));
    assert.notEqual(a, pairwiseSub('rp2.agency.invalid', 'user-1', 'salt'));
    assert.notEqual(a, pairwiseSub('rp1.agency.invalid', 'user-2', 'salt'));
    assert.notEqual(a, pairwiseSub('rp1.agency.invalid', 'user-1', 'other'));
  });
  it('sector: the sector identifier URI host, else the one host of the redirect URIs, else none', () => {
    assert.equal(sectorOf('https://sector.agency.invalid/ids.json', ['https://a.invalid/cb']), 'sector.agency.invalid');
    assert.equal(sectorOf(undefined, ['https://rp1.agency.invalid/cb', 'https://rp1.agency.invalid/other']), 'rp1.agency.invalid');
    assert.equal(sectorOf(undefined, ['https://a.invalid/cb', 'https://b.invalid/cb']), null);
  });
});
