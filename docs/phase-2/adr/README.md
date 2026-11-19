# Architecture Decision Records (Phase 2)

| | |
|---|---|
| Status of all ADRs | **Proposed — awaiting founder approval.** Acceptance criterion O-AC2 ("all ADRs approved") is open |
| Numbering | ADR-001 to ADR-014 keep the topics of the Phase 0 §8.12 backlog **unchanged** (original deliverable O-D1). ADR-015 to ADR-029 are new decisions needed by the Phase 2 mission and the roadmap's additive items R-1 to R-5 |
| How to approve | The founder records approval, rejection or change requests per ADR in the [readiness report](../phase-2-readiness-report.md) §4 (decision P2-D1). An approved ADR changes status to **Accepted** with the date; a rejected one to **Rejected** with the reason |
| Template | Context, Decision, Consequences, Alternatives, Validation, Revisit when |
| Plain-language explanation for the founder | [../founder-review/P2-D1-adr-review-package.md](../founder-review/P2-D1-adr-review-package.md) |

| ADR | Title | Origin | Covers |
|---|---|---|---|
| [ADR-001](ADR-001-modular-monolith-and-separate-deployables.md) | Modular monolith with separately deployed health-bridge, guide and key service | Phase 0 | O-A1, O-D4 |
| [ADR-002](ADR-002-typescript-end-to-end.md) | TypeScript end-to-end, strict mode | Phase 0 | D7 |
| [ADR-003](ADR-003-postgresql-per-tier-clusters-schema-per-module-rls.md) | PostgreSQL per-tier clusters, schema per module, row-level security for tenants | Phase 0 | O-A3, O-DB1, R-1, R-3 |
| [ADR-004](ADR-004-country-cell-deployment-model.md) | Country-cell deployment model; no cross-cell data flows | Phase 0 | R-5, D9 |
| [ADR-005](ADR-005-keycloak-identity-broker.md) | Keycloak as identity broker; passkeys first; SMS OTP fallback only | Phase 0 | O-A2 |
| [ADR-006](ADR-006-policy-engine-for-abac.md) | Policy engine for ABAC: Cedar (OPA evaluated) | Phase 0 | O-A7 |
| [ADR-007](ADR-007-fhir-server-choice-deferred.md) | FHIR server choice — deferred to Phase 7 | Phase 0 | R-3 (health domain boundary only) |
| [ADR-008](ADR-008-outbox-and-bullmq.md) | Transactional outbox + BullMQ; broker abstraction | Phase 0 | O-A4 |
| [ADR-009](ADR-009-verifiable-credentials-standards.md) | Verifiable credentials: W3C VC 2.0, SD-JWT VC, OpenID4VCI/VP; ISO mDL for licences | Phase 0 | Division D (Identity), Phase 4 |
| [ADR-010](ADR-010-rag-assistant-and-model-gateway.md) | RAG-only assistant with citation enforcement; model gateway with location policy | Phase 0 | Division E; D10 |
| [ADR-011](ADR-011-self-hosted-observability.md) | Self-hosted observability; no personal data in logs | Phase 0 | O-A6 |
| [ADR-012](ADR-012-openbao-hsm-envelope-encryption.md) | OpenBao + HSM; envelope encryption; per-tenant keys | Phase 0 | O-SEC1 |
| [ADR-013](ADR-013-kubernetes-helm-opentofu-argocd.md) | Kubernetes (RKE2/k3s), Helm, OpenTofu, Ansible, Argo CD pull deployments | Phase 0 | O-D5, O-D6, O-T3, R-2 |
| [ADR-014](ADR-014-accessibility-and-rtl-release-gates.md) | Accessibility (WCAG 2.2 AA) and RTL as release gates | Phase 0 | O-F3 |
| [ADR-015](ADR-015-api-standards.md) | API standards: REST, OpenAPI contract, versioning, errors, idempotency | New | O-API1–3; Phase 0 §8.9 |
| [ADR-016](ADR-016-multi-tenancy-model-and-isolation-tiers.md) | Multi-tenancy model and isolation tiers | New | R-1; Phase 1 capability #3 |
| [ADR-017](ADR-017-country-packs-and-rule-packs.md) | Country packs and rule packs as versioned, integrity-checked configuration | New | R-4 (FR-66); Phase 1 capability #4 |
| [ADR-018](ADR-018-data-classification-inventory-and-governance.md) | Data classification, inventory and governance | New | O-D3, R-3 |
| [ADR-019](ADR-019-deployment-tiers-including-customer-hosted.md) | Deployment tiers including customer-hosted cells | New | R-2 |
| [ADR-020](ADR-020-object-storage.md) | Object storage: S3-compatible API | New | O-A5; Phase 0 §8.2 (S3-compatible) |
| [ADR-021](ADR-021-feature-flags-openfeature.md) | Feature flags: OpenFeature with an in-process provider | New | O-F2 |
| [ADR-022](ADR-022-identifiers-time-money-locale-conventions.md) | Identifiers, time, money and locale conventions | New | O-F3; Phase 0 §9.1, §9.6 |
| [ADR-023](ADR-023-monorepo-and-repository-structure.md) | Monorepo and repository structure | New | O-D4; D11 |
| [ADR-024](ADR-024-database-migration-tooling.md) | Database migration tooling: node-pg-migrate (SQL), expand/contract | New | O-DB2 |
| [ADR-025](ADR-025-environments-and-synthetic-data.md) | Environments and synthetic data | New | O-D7; D9; Phase 0 §10.12 |
| [ADR-026](ADR-026-ai-agent-runtime.md) | AI agent runtime: identities, tool permissions, human approval, evaluation | New | Mission topic "AI and agent infrastructure"; D10 |
| [ADR-027](ADR-027-software-supply-chain-security.md) | Software supply-chain security | New | O-SEC2, O-SEC3, O-T2 |
| [ADR-028](ADR-028-integration-adapter-framework-and-classes.md) | Integration adapter framework and the six integration classes | New | P1-D6; Phase 0 §8.7; Phase 1 capability #14 |
| [ADR-029](ADR-029-backup-disaster-recovery-and-residency.md) | Backup, disaster recovery and data residency | New | R-5; PRD §12.7 (RPO ≤ 15 min, RTO ≤ 4 h); Phase 0 §9.9, §10.11 |

**Design-only ADRs (nothing built before their phase):** ADR-007 (Phase 7), ADR-009 (Phase 4), ADR-010 and ADR-026 (Phase 10).

