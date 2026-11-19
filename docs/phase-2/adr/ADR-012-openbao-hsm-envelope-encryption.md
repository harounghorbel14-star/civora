# ADR-012: OpenBao + HSM; envelope encryption; per-tenant keys

| | |
|---|---|
| Status | **Proposed — awaiting founder approval (acceptance criterion O-AC2)** |
| Date | 19 November 2026 |
| Origin | Phase 0 §8.12 backlog item 012 (topic unchanged) |
| Covers | O-SEC1 |
| Deciders | Founder (approval); engineering (author) |

## Context

- T0/T1 fields need field-level encryption with per-tenant keys and crypto-shredding at exit (Phase 0 §10.5).
- Signing keys for audit anchors, documents and credentials need an HSM in production.

## Decision

- **OpenBao** (open-source Vault fork) per cell, HA (Raft) in staging/production, auto-unseal via HSM; M-of-N unseal and recovery shares.
- Transit engine: one key per tenant to wrap that tenant's data keys (AES-256-GCM).
- PKI engine for the cell's internal certificates; Kubernetes auth for workloads; External Secrets Operator delivers secrets as **mounted files**.
- Signing keys in the HSM behind the key & signing service (Phase 4).

## Consequences

**Positive**

- Crypto-shredding per tenant; secrets never in Git or images.

**Negative / costs**

- OpenBao availability becomes critical (HA, cached wrapped keys).

## Alternatives considered

| Option | Outcome |
|---|---|
| HashiCorp Vault | Equivalent technically; licence (BSL) less suitable for customer-hosted redistribution |
| Cloud KMS | Not available in-country [U] |

## Validation

- OpenBao 2.4.1 dev mode runs in the dev cell (unsealed, smoke test). Core supports `DATABASE_URL_FILE` (unit test); the chart mounts the secret as a file.

## Revisit when

Provider selection (HSM availability).
