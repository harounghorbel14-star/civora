# ADR-011: Self-hosted observability; no personal data in logs

| | |
|---|---|
| Status | **Proposed — awaiting founder approval (acceptance criterion O-AC2)** |
| Date | 19 November 2026 |
| Origin | Phase 0 §8.12 backlog item 011 (topic unchanged) |
| Covers | O-A6 |
| Deciders | Founder (approval); engineering (author) |

## Context

- Logs and traces may contain metadata about people and must stay in-country.
- Operations need metrics, logs, traces and alerts from day one (Phase 1 capability #15).

## Decision

- OpenTelemetry collector + Prometheus + Loki + Tempo + Grafana **inside each cell**; Alertmanager for on-call; a public status page without internals.
- Logs are fixed-field JSON (timestamp, level, service, context, message, request id, tenant id). No bodies, headers, tokens or identifiers.
- The application exports spans only through an attribute allow-list (route templates, status codes, framework and database operation names; no URLs, client addresses, user agents, headers, SQL text or exception messages); the collector adds a second scrubber. A CI scrubbing test enforces it.
- Self-hosted error tracking (GlitchTip or Sentry self-hosted) when the first UI ships.

## Consequences

**Positive**

- Residency and privacy by construction.

**Negative / costs**

- We operate the stack ourselves (storage, upgrades).

## Alternatives considered

| Option | Outcome |
|---|---|
| SaaS APM | Rejected: data leaves the country |

## Validation

- Dev cell runs grafana/otel-lgtm 0.11.0 with login required; core exposes `/metrics` (e2e test) and fixed-field JSON logs.
- Tracing (added 19 Nov 2026): OpenTelemetry 3.0 SDK with HTTP, Express, NestJS and pg instrumentation; spans leave only through an attribute allow-list. An e2e test sends synthetic identifiers in the query string and headers and asserts they never reach the collector (negative control: with the filter disabled the test fails). Dev-cell smoke test confirms traces reach Tempo without request data.

## Revisit when

Phase 11 (SIEM integration).
