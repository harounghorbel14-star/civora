# Spike: OPA (Rego) vs Cedar for CIVORA ABAC (O-A7)

| | |
|---|---|
| Original deliverable | Phase 2 architecture item **O-A7** "OPA/Cedar evaluation spike"; Phase 0 **ADR-006** "OPA or Cedar for ABAC (evaluate both in Phase 2)" |
| Date run | 19 November 2026 |
| Status | **Complete.** Result feeds [ADR-006](../../docs/phase-2/adr/ADR-006-policy-engine-for-abac.md) (Proposed — awaiting founder approval) |
| Data | Synthetic principals and cases only |
| Not shipped | This folder is outside the pnpm workspace and is never deployed |

## 1. What was tested

The same eight rules were written in both languages. They come from the Workspace RF requirements (PRD 1.1) and the Government-track Tier T0 (health) rule:

| Rule | Meaning |
|---|---|
| P1 | A case handler reads and updates cases of their own tenant **and** unit, including internal notes |
| P2 | A supervisor acts on every case of their tenant |
| P3 | The BCT correspondent exports a case for the banking mediator (FR-26; Circular 2022-08 Art. 13) |
| P4 | A customer reads the status of their own case only |
| P5 | A tenant administrator changes rule-pack settings only with MFA |
| P6 | CIVORA operations may read a case only through break-glass: MFA **and** a written justification |
| F1 | Tenant isolation: nothing crosses tenants except a P6 read (break-glass never allows updates) |
| F2 | Tier T0 (special category: health) data only for the "care" purpose with recorded consent |

Files:
- [policies/civora.cedar](policies/civora.cedar) and its schema [policies/civora.cedarschema](policies/civora.cedarschema)
- [policies/civora.rego](policies/civora.rego) (OPA 1.x syntax)
- [cases.json](cases.json): **24 decision cases** (10 allow, 14 deny), engine-neutral. It becomes the conformance suite for whichever engine is chosen.
- [run.mjs](run.mjs), [build-opa-wasm.sh](build-opa-wasm.sh)
- Raw results: [results-2026-11-19.json](results-2026-11-19.json)

Engines and versions:
- Cedar **4.14.0** via `@cedar-policy/cedar-wasm` (in-process WebAssembly in Node 22)
- OPA **1.4.2** (`openpolicyagent/opa:1.4.2`): compiled to WebAssembly and run in-process with `@open-policy-agent/opa-wasm` 1.10.0; also run as a REST sidecar

## 2. Results

**Correctness.** All three evaluators returned the expected decision for **24 of 24** cases.
- Cedar: the policies pass **strict schema validation**. Every request was also validated against the schema.
- OPA: `opa check --strict` passes.

**Latency** (20,000 decisions cycling through the 24 cases; 4 vCPU Xeon 2.1 GHz sandbox; Node 22.23):

| Evaluator | p50 | p99 | Notes |
|---|---|---|---|
| OPA, wasm in-process | **7.7 µs** | 23.6 µs | Input passed as a plain object |
| Cedar, wasm in-process, pre-parsed policies and schema | **246.9 µs** | 559.8 µs | With per-request schema validation |
| Cedar, same, request validation off | 236.3 µs | 457.2 µs | Validation itself is cheap |
| Cedar, wasm, policies re-parsed on every call | 2,328 µs | 3,866 µs | Anti-pattern: always pre-parse |
| OPA REST sidecar on loopback | 711 µs | 2,414 µs | 5,000 calls; includes HTTP and JSON. Measured in the first run of the day (same rules; the T0 attribute was renumbered afterwards) |

**Interpretation.**
- Every option except per-call re-parsing is far below a 5 ms authorisation budget per request. Performance does not decide the choice.
- Cedar's cost in Node comes mostly from passing entities across the WebAssembly boundary as JSON. The native Rust library is much faster; it is not needed at CIVORA's scale.

## 3. Qualitative comparison

| Criterion | Cedar | OPA / Rego | Weight for CIVORA |
|---|---|---|---|
| Policy can be checked against a typed schema before deployment | **Yes, built in.** The validator rejects unknown attributes, wrong types and impossible actions | Optional (JSON Schema annotations); not enforced by default | High. Rule packs and tenant policies are versioned configuration (FR-66); errors must fail CI, not production |
| Readability for auditors, compliance staff and bank reviewers | Close to plain language: `permit`/`forbid` with `when`/`unless` | Logic-programming style; a steeper learning curve | High. Banks and the BCT may ask to see access rules |
| Default-deny and forbid-overrides-permit semantics | Built into the language | Must be written by hand (done here with `permit`/`forbid` rules) | High |
| Filtering lists ("all cases I can see") | Partial evaluation exists (`isAuthorizedPartial`), less mature | Mature partial evaluation that can produce SQL-like filters | Medium. Tenant isolation is enforced by PostgreSQL row-level security anyway (ADR-003). Unit filters are simple SQL |
| Ecosystem beyond the application | Application authorisation only | Kubernetes admission (Gatekeeper), IaC checks (conftest), API gateways | Medium. Kubernetes uses built-in Pod Security Admission; CI uses Checkov |
| Deployment | In-process library, no extra service | In-process (wasm) or sidecar or central server | Neutral |
| Licence | Apache-2.0 | Apache-2.0 | Neutral |
| Supply-chain observation | npm `@cedar-policy/cedar-wasm@4.14.1` was published **empty** (2 files, no wasm). Pinned 4.14.0 instead | No issue observed | Shows why exact pins and lockfile integrity checks matter (ADR-027) |

## 4. Recommendation (input to ADR-006; founder decides)

**Use Cedar for application authorisation in `civora-core`.**
- Load policies and schema once per pack version, using `preparsePolicySet` and `preparseSchema`.
- Validate policies in CI against the schema.
- Keep [cases.json](cases.json) as the conformance suite.

**Do not adopt OPA for application authorisation.**
- Revisit OPA only if list filtering through partial evaluation becomes a bottleneck that SQL and row-level security cannot handle.
- Infrastructure policy stays with Kubernetes Pod Security Admission and CI scanners. No second policy language is added in Phase 2.

**Exit path.** The rules are small and the decision table is engine-neutral, so switching engines later means rewriting fewer than 100 lines of policy and re-running this suite.

## 5. How to reproduce

```bash
cd spikes/policy-engine
npm install --ignore-scripts
./build-opa-wasm.sh                 # needs Docker
node run.mjs --iterations 20000
# optional REST sidecar measurement:
docker run -d --name opa-spike -p 127.0.0.1:8181:8181 -v "$PWD/policies:/p:ro" openpolicyagent/opa:1.4.2 run --server --addr 0.0.0.0:8181 /p/civora.rego
OPA_URL=http://127.0.0.1:8181 node run.mjs
```
