# ADR-019: Deployment tiers including customer-hosted cells

| | |
|---|---|
| Status | **Proposed — awaiting founder approval (acceptance criterion O-AC2)** |
| Date | 19 November 2026 |
| Origin | New in Phase 2 |
| Covers | R-2 |
| Deciders | Founder (approval); engineering (author) |

## Context

- Some banks may not be allowed or willing to outsource (Law 2016-48 Art. 81 outcome pending).
- Government systems may have to run at CNI.

## Decision

- Four tiers: shared cell, shared cell with dedicated DB, dedicated cell, customer-hosted cell (operated by the customer or by CIVORA under contract).
- Customer-hosted delivery is an **air-gapped bundle**: images, chart, country pack, SBOMs, signatures, checksums, release notes.
- No runtime dependency outside the cell; bring-your-own PostgreSQL, IdP, HSM and object storage are supported through standard interfaces.
- TLS-inspecting proxies are supported at build and install time without baking CAs into images.

## Consequences

**Positive**

- Keeps the bank market open whatever counsel concludes.

**Negative / costs**

- Support cost and version spread across customer sites.

## Alternatives considered

| Option | Outcome |
|---|---|
| SaaS only | Rejected: may exclude banks |
| Separate on-premises edition | Rejected: code fork |

## Validation

- Air-gapped k3s rehearsal script (preloaded images); RKE2 role supports an air-gap directory; proxy CA handled as a build secret.

## Revisit when

Counsel Tier B memo (outsourcing).
