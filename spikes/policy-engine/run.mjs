// O-A7 spike runner: evaluates the shared decision table with Cedar (in-process wasm), OPA (in-process wasm)
// and, when OPA_URL is set, OPA as a REST sidecar. Reports correctness, schema validation and latency.
// Usage: npm install --ignore-scripts && ./build-opa-wasm.sh && node run.mjs [--iterations 20000]
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';

const require = createRequire(import.meta.url);
const cedar = require('@cedar-policy/cedar-wasm/nodejs');
const { loadPolicy } = require('@open-policy-agent/opa-wasm');

const iterations = Number(process.argv[process.argv.indexOf('--iterations') + 1] || 20000);
const table = JSON.parse(readFileSync(new URL('./cases.json', import.meta.url)));
const schemaText = readFileSync(new URL('./policies/civora.cedarschema', import.meta.url), 'utf8');
const cedarPolicies = readFileSync(new URL('./policies/civora.cedar', import.meta.url), 'utf8');

const ctxOf = (c) => ({ ...table.defaultContext, ...(c.ctx ?? {}) });

// ---------- Cedar ----------
const uid = (type, id) => ({ type, id });
function cedarEntities() {
  const ents = new Map();
  const add = (e) => ents.set(`${e.uid.type}::${e.uid.id}`, e);
  for (const t of new Set([...Object.values(table.principals), ...Object.values(table.resources)].map((x) => x.tenant))) {
    add({ uid: uid('Tenant', t), attrs: {}, parents: [] });
  }
  for (const p of Object.values(table.principals)) {
    if (p.type === 'User') add({ uid: uid('User', p.id), attrs: { tenant: { __entity: uid('Tenant', p.tenant) }, roles: p.roles, unit: p.unit }, parents: [] });
    else add({ uid: uid('Customer', p.id), attrs: { tenant: { __entity: uid('Tenant', p.tenant) } }, parents: [] });
  }
  for (const r of Object.values(table.resources)) {
    if (r.type === 'Case') {
      add({ uid: uid('Case', r.id), attrs: { tenant: { __entity: uid('Tenant', r.tenant) }, unit: r.unit, customer: { __entity: uid('Customer', r.customer) }, dataTier: r.dataTier }, parents: [] });
    } else add({ uid: uid('RulePackActivation', r.id), attrs: { tenant: { __entity: uid('Tenant', r.tenant) } }, parents: [] });
  }
  return [...ents.values()];
}
const allEntities = cedarEntities();
const byKey = new Map(allEntities.map((e) => [`${e.uid.type}::${e.uid.id}`, e]));
// Per request, only the entities the decision needs (principal, resource, their tenants, the case's customer),
// as the application would load them. Passing the whole store would measure JSON transfer, not evaluation.
const slice = (p, r) => {
  const keys = new Set([`${p.type}::${p.id}`, `${r.type}::${r.id}`, `Tenant::${p.tenant}`, `Tenant::${r.tenant}`]);
  if (r.customer) keys.add(`Customer::${r.customer}`);
  return [...keys].map((k) => byKey.get(k)).filter(Boolean);
};
const cedarCall = (c) => {
  const p = table.principals[c.p];
  const r = table.resources[c.r];
  return {
    principal: uid(p.type, p.id),
    action: uid('Action', c.a),
    resource: uid(r.type, r.id),
    context: ctxOf(c),
    entities: slice(p, r),
  };
};

const validation = cedar.validate({ schema: schemaText, policies: { staticPolicies: cedarPolicies }, validationSettings: { mode: 'strict' } });
const schemaOk = validation.type === 'success' && validation.validationErrors.length === 0;
const pre1 = cedar.preparsePolicySet('civora', { staticPolicies: cedarPolicies });
const pre2 = cedar.preparseSchema('civora', schemaText);
if (pre1.type !== 'success' || pre2.type !== 'success') throw new Error('Cedar preparse failed: ' + JSON.stringify([pre1, pre2]));

function cedarDecide(c, stateful = true, validateRequest = true) {
  const call = cedarCall(c);
  const ans = stateful
    ? cedar.statefulIsAuthorized({ ...call, preparsedPolicySetId: 'civora', preparsedSchemaName: 'civora', validateRequest })
    : cedar.isAuthorized({ ...call, policies: { staticPolicies: cedarPolicies }, schema: schemaText, validateRequest: true });
  if (ans.type !== 'success') throw new Error(`${c.id}: ${JSON.stringify(ans.errors)}`);
  return { decision: ans.response.decision, reasons: ans.response.diagnostics.reason };
}

// ---------- OPA (wasm) ----------
const opaInput = (c) => ({ principal: table.principals[c.p], action: c.a, resource: table.resources[c.r], context: ctxOf(c) });
let opa = null;
if (existsSync(new URL('./out/policy.wasm', import.meta.url))) {
  opa = await loadPolicy(readFileSync(new URL('./out/policy.wasm', import.meta.url)));
}
const opaDecide = (c) => (opa.evaluate(opaInput(c))[0]?.result === true ? 'allow' : 'deny');

// ---------- OPA (REST sidecar, optional) ----------
async function opaRestDecide(c) {
  const res = await fetch(`${process.env.OPA_URL}/v1/data/civora/authz/allow`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ input: opaInput(c) }) });
  const body = await res.json();
  return body.result === true ? 'allow' : 'deny';
}

// ---------- Correctness ----------
const rows = [];
let mismatches = 0;
for (const c of table.cases) {
  const ce = cedarDecide(c);
  const cd = ce.decision;
  const od = opa ? opaDecide(c) : 'n/a';
  const rd = process.env.OPA_URL ? await opaRestDecide(c) : 'n/a';
  const ok = cd === c.expect && (od === 'n/a' || od === c.expect) && (rd === 'n/a' || rd === c.expect);
  if (!ok) mismatches++;
  rows.push({ id: c.id, expect: c.expect, cedar: cd, cedarReasons: ce.reasons.join(','), opaWasm: od, opaRest: rd, ok, why: c.why });
}

// ---------- Latency ----------
function bench(fn) {
  const n = iterations;
  const cs = table.cases;
  for (let i = 0; i < 500; i++) fn(cs[i % cs.length]); // warm-up
  const t = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const s = performance.now();
    fn(cs[i % cs.length]);
    t[i] = performance.now() - s;
  }
  t.sort();
  const q = (p) => t[Math.min(n - 1, Math.floor(p * n))] * 1000;
  return { n, p50_us: +q(0.5).toFixed(1), p99_us: +q(0.99).toFixed(1), max_us: +(t[n - 1] * 1000).toFixed(1) };
}
async function benchAsync(fn, n) {
  const cs = table.cases;
  for (let i = 0; i < 100; i++) await fn(cs[i % cs.length]);
  const t = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const s = performance.now();
    await fn(cs[i % cs.length]);
    t[i] = performance.now() - s;
  }
  t.sort();
  const q = (p) => t[Math.min(n - 1, Math.floor(p * n))] * 1000;
  return { n, p50_us: +q(0.5).toFixed(1), p99_us: +q(0.99).toFixed(1), max_us: +(t[n - 1] * 1000).toFixed(1) };
}
const latency = {
  cedarStateful: bench((c) => cedarDecide(c, true)),
  cedarStatefulNoRequestValidation: bench((c) => cedarDecide(c, true, false)),
  cedarStateless: bench((c) => cedarDecide(c, false)),
  ...(opa ? { opaWasm: bench((c) => opaDecide(c)) } : {}),
  ...(process.env.OPA_URL ? { opaRestSidecar: await benchAsync(opaRestDecide, Math.min(iterations, 5000)) } : {}),
};

const result = {
  date: new Date().toISOString(),
  node: process.version,
  cedarVersion: cedar.getCedarVersion(),
  cedarSchemaStrictValidation: schemaOk ? 'pass' : validation,
  opaWasm: opa ? 'loaded' : 'not built (run ./build-opa-wasm.sh)',
  cases: rows.length,
  mismatches,
  latency,
  rows,
};
writeFileSync(new URL('./out/results.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.table(rows.map(({ cedarReasons, why, ...r }) => r));
console.log(JSON.stringify({ cedarVersion: result.cedarVersion, schema: schemaOk ? 'pass' : 'FAIL', cases: rows.length, mismatches, latency }, null, 2));
process.exit(mismatches === 0 && schemaOk ? 0 : 1);
