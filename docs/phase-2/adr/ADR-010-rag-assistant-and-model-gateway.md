# ADR-010: RAG-only assistant with citation enforcement; model gateway with location policy

| | |
|---|---|
| Status | **Proposed — awaiting founder approval (acceptance criterion O-AC2)** |
| Date | 19 November 2026 |
| Origin | Phase 0 §8.12 backlog item 010 (topic unchanged) |
| Covers | Division E; D10 |
| Deciders | Founder (approval); engineering (author) |

## Context

- No AI components before Phase 10 (Phase 1 §18.3).
- D10: in-country models for personal data; foreign models only for public content, no personal data, client approval.

## Decision

- **Design-level decision; nothing built in Phase 2** ([12](../12-ai-and-agent-infrastructure.md)).
- The Guide answers only from retrieved official passages and must cite them; it refuses below a confidence threshold.
- PII redaction happens before any model call.
- A model gateway applies a per-pack location policy; foreign routes are absent from pilot and production packs unless approved.
- Release gates: ≥ 500 golden questions per language (MSA, Derja, Arabizi, FR, EN), ≥ 95% factual accuracy.

## Consequences

**Positive**

- Data boundaries are fixed before any AI code exists.

**Negative / costs**

- Tunisian GPU availability is unknown [U].

## Alternatives considered

| Option | Outcome |
|---|---|
| Free-form chat assistant | Rejected: hallucination and rights risk |

## Validation

- None in Phase 2 (design only).

## Revisit when

Phase 10; earlier design review if P1-D3 or P1-D14 changes.
