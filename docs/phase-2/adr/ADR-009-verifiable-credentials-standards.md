# ADR-009: Verifiable credentials: W3C VC 2.0, SD-JWT VC, OpenID4VCI/VP; ISO mDL for licences

| | |
|---|---|
| Status | **Accepted** — approved by the founder on 21 Nov 2026 (decision P2-D1; [decision record](../founder-review/P2-founder-decision-record.md)) |
| Date | 19 November 2026 |
| Origin | Phase 0 §8.12 backlog item 009 (topic unchanged) |
| Covers | Division D (Identity), Phase 4 |
| Deciders | Founder (approval); engineering (author) |

## Context

- The wallet module (Phase 4) issues and verifies credentials; standards choice affects interoperability with any future national wallet.

## Decision

- **Design-level decision only; nothing is built in Phase 2.** Formats: W3C VC Data Model 2.0 and SD-JWT VC for selective disclosure; issuance and presentation via OpenID4VCI / OpenID4VP; ISO/IEC 18013-5 mDL for driving-licence-type credentials.
- Issuer keys live in the HSM behind the key & signing service (ADR-001, ADR-012); status lists for revocation.
- No credential is issued on behalf of the state without authorisation (integration class 1–2).

## Consequences

**Positive**

- Aligns with EU and international wallet ecosystems.

**Negative / costs**

- Standards are still moving; versions are pinned in Phase 4.

## Alternatives considered

| Option | Outcome |
|---|---|
| Proprietary signed PDFs only | Rejected: no selective disclosure, poor verifiability |

## Validation

- None in Phase 2 (design only).

## Revisit when

Phase 4.
