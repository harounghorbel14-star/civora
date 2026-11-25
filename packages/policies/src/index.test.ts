import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { type EntityJson, MANDATE_ACTIONS, type MandateFacts, PolicyEngine } from './index';

const dir = join(__dirname, '..');
const read = (p: string) => readFileSync(join(dir, p), 'utf8');
const json = (p: string) => JSON.parse(read(p));
const engine = PolicyEngine.load();

/** The spike's decision table (spikes/policy-engine/cases.json), evaluated as the core will evaluate it. */
function platformCases(e: PolicyEngine) {
  const t = json('cases/platform.json');
  const ref = (type: string, id: string) => ({ __entity: { type, id } });
  const ents = new Map<string, EntityJson>();
  const add = (x: EntityJson) => ents.set(`${x.uid.type}::${x.uid.id}`, x);
  for (const p of Object.values<Record<string, unknown>>(t.principals)) {
    add({ uid: { type: 'Tenant', id: String(p.tenant) }, attrs: {}, parents: [] });
    if (p.type === 'User') add({ uid: { type: 'User', id: String(p.id) }, attrs: { tenant: ref('Tenant', String(p.tenant)), roles: p.roles, unit: p.unit }, parents: [] });
    else add({ uid: { type: 'Customer', id: String(p.id) }, attrs: { tenant: ref('Tenant', String(p.tenant)) }, parents: [] });
  }
  for (const r of Object.values<Record<string, unknown>>(t.resources)) {
    add({ uid: { type: 'Tenant', id: String(r.tenant) }, attrs: {}, parents: [] });
    if (r.type === 'Case') add({ uid: { type: 'Case', id: String(r.id) }, attrs: { tenant: ref('Tenant', String(r.tenant)), unit: r.unit, customer: ref('Customer', String(r.customer)), dataTier: r.dataTier }, parents: [] });
    else add({ uid: { type: 'RulePackActivation', id: String(r.id) }, attrs: { tenant: ref('Tenant', String(r.tenant)) }, parents: [] });
  }
  return (t.cases as Record<string, unknown>[]).map((c) => {
    const p = t.principals[String(c.p)];
    const r = t.resources[String(c.r)];
    const d = e.decide({ principal: { type: p.type, id: p.id }, action: String(c.a), resource: { type: r.type, id: r.id }, context: { ...t.defaultContext, ...(c.ctx as object) }, entities: [...ents.values()] });
    return { id: String(c.id), expect: c.expect, got: d.allowed ? 'allow' : 'deny', d };
  });
}

function mandateCases(e: PolicyEngine) {
  const t = json('cases/mandates.json');
  return (t.cases as { id: string; p: string; a: string; r: string; under?: string; expect: string }[]).map((c) => {
    const rec = t.records[c.r];
    const m = c.under ? ({ id: c.under, ...t.mandates[c.under] } as MandateFacts) : undefined;
    const d = e.mandateDecision({ actor: c.p, action: c.a, owner: rec.owner, recordDomain: rec.domain, mandate: m });
    return { id: c.id, expect: c.expect, got: d.allowed ? 'allow' : 'deny', d };
  });
}

describe('Cedar policies (ADR-006)', () => {
  it('all policies pass strict schema validation (load throws otherwise)', () => {
    assert.match(engine.cedarVersion, /^4\./);
  });

  it('platform rules: the spike\'s 24 decision cases (Workspace RF, break-glass, tenant isolation, Tier T0)', () => {
    const rows = platformCases(engine);
    assert.equal(rows.length, 24);
    for (const r of rows) assert.equal(r.got, r.expect, `${r.id}: ${JSON.stringify(r.d)}`);
  });

  it('mandate rules (P3-T4): 20 decision cases, every one as expected and without evaluation errors', () => {
    const rows = mandateCases(engine);
    assert.equal(rows.length, 20);
    for (const r of rows) {
      assert.equal(r.got, r.expect, `${r.id}: ${JSON.stringify(r.d)}`);
      assert.deepEqual(r.d.errors, [], r.id);
    }
  });

  it('every mandate action exists in the schema and is denied without any relation', () => {
    for (const a of MANDATE_ACTIONS) {
      const d = engine.mandateDecision({ actor: 'x', action: a, owner: 'y' });
      assert.equal(d.allowed, false, a);
      assert.deepEqual(d.errors, [], a);
    }
    assert.equal(engine.mandateDecision({ actor: 'x', action: 'cases:delete', owner: 'x' }).allowed, false, 'unknown action');
  });

  // Negative controls: each weakened policy set must flip at least one case, or the cases do not test that rule.
  const base = read('policies/platform.cedar') + '\n' + read('policies/mandates.cedar');
  // For a forbid rule, a mistaken future permit is added: with the forbid in place the case must still be denied
  // (checked separately below); without it, the case flips.
  const mistakenIdentityPermit = '\npermit (principal is Person, action == Action::"identity:manage", resource is PersonalRecord) when { context has actingUnder };';
  const mistakenSupervisorPermit = '\npermit (principal is User, action == Action::"case:read", resource is Case) when { principal.roles.contains("supervisor") };';
  const weakened: [string, (s: string) => string, string][] = [
    ['identity delegated (F3 removed, a mistaken permit added)', (s) => s.replace(/@id\("F3-never-delegated"\)[\s\S]*?\};/, '') + mistakenIdentityPermit, 'M15'],
    ['inactive mandates accepted', (s) => s.replaceAll('context.actingUnder.active &&', ''), 'M12'],
    ['any agent accepted', (s) => s.replaceAll('context.actingUnder.agent == principal &&', ''), 'M13'],
    ['owner not checked', (s) => s.replaceAll('context.actingUnder.principal == resource.owner &&', ''), 'M11'],
    ['domain not checked', (s) => s.replace(/(@id\("M2-mandate-cases-read"\)[\s\S]*?)resource\.domain == "cases" &&/, '$1'), 'M10'],
    ['read covers submit', (s) => s.replace(/(@id\("M2-mandate-cases-submit"\)[\s\S]*?containsAny\(\[)/, '$1"cases:read", '), 'M05'],
    ['own rules apply while acting', (s) => s.replace(/(@id\("M1-own-cases"\)[\s\S]*?) && !\(context has actingUnder\)/, '$1'), 'M14'],
    ['tenant isolation removed (F1, a mistaken cross-tenant permit added)', (s) => s.replace(/@id\("F1-tenant-isolation"\)[\s\S]*?\};/, '') + mistakenSupervisorPermit, 'C05'],
  ];
  it('forbid rules hold against mistaken permits: F1 keeps tenants apart, F3 keeps identity undelegated', () => {
    const weak = PolicyEngine.load(undefined, { policies: base + mistakenIdentityPermit + mistakenSupervisorPermit });
    const rows = [...platformCases(weak), ...mandateCases(weak)];
    for (const id of ['C05', 'M15', 'M16']) assert.equal(rows.find((r) => r.id === id)!.got, 'deny', id);
  });
  for (const [name, mutate, flips] of weakened) {
    it(`negative control rejected: ${name} (case ${flips} flips)`, () => {
      const policies = mutate(base);
      assert.notEqual(policies, base, 'the mutation changed nothing');
      const weak = PolicyEngine.load(undefined, { policies });
      const rows = [...platformCases(weak), ...mandateCases(weak)];
      const row = rows.find((r) => r.id === flips)!;
      assert.notEqual(row.got, row.expect, `${flips} should flip under "${name}"`);
    });
  }
});
