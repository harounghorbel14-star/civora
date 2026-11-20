import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCountryPack } from '@civora/country-packs';
import { generate } from './index';

const loaded = loadCountryPack('tn');

test('same seed gives identical output; different seed differs', () => {
  const a = generate({ seed: 7, tenants: 2, casesPerTenant: 50 }, loaded);
  const b = generate({ seed: 7, tenants: 2, casesPerTenant: 50 }, loaded);
  const c = generate({ seed: 8, tenants: 2, casesPerTenant: 50 }, loaded);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.cases, c.cases);
});

test('every record is flagged synthetic and identifiers are non-issuable per the pack', () => {
  const ds = generate({ seed: 1, tenants: 3, casesPerTenant: 300 }, loaded);
  const ids = loaded.pack.identifiers;
  const cin = new RegExp(ids.cin!.syntheticPattern);
  const phone = new RegExp(ids.phone!.syntheticPattern);
  const email = new RegExp(ids.email!.syntheticPattern);
  for (const t of ds.tenants) assert.equal(t.synthetic, true);
  for (const c of ds.customers) {
    assert.equal(c.synthetic, true);
    if (c.cin !== null) assert.match(c.cin, cin);
    assert.match(c.phone, phone);
    assert.doesNotMatch(c.phone, new RegExp(ids.phone!.pattern)); // never a valid issuable number
    assert.match(c.email, email);
  }
  for (const k of ds.cases) assert.ok(k.reference.startsWith('SYN-'));
});

test('regulatory deadlines follow the rule pack and the calendar', () => {
  const ds = generate({ seed: 3, tenants: 3, casesPerTenant: 200 }, loaded);
  const bankTenant = ds.tenants.find((t) => t.rulePack === 'RP-BCT-2022-08')!;
  const piTenant = ds.tenants.find((t) => t.rulePack === 'RP-BCT-2026-10')!;
  for (const k of ds.cases.filter((x) => x.tenantId === bankTenant.id)) {
    if (k.caseType === 'complaint') assert.ok(k.regulatoryDueOn && k.regulatoryDueOn > k.receivedOn);
    else assert.equal(k.regulatoryDueOn, null);
  }
  for (const k of ds.cases.filter((x) => x.tenantId === piTenant.id)) assert.equal(k.regulatoryDueOn, null); // 2026-10 sets no ceiling
  const subjects = new Set(ds.cases.filter((x) => x.tenantId === bankTenant.id).map((x) => x.subject));
  for (const s of subjects) assert.ok(loaded.rulePacks['RP-BCT-2022-08']!.subjects!.includes(s));
});
