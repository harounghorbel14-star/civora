# Simulators (dev cell and tests only)

Realms here stand in for **external systems CIVORA is not authorised to integrate with** (integration class 3,
[integration status register](../../../docs/phase-0/integration-status-register.md)). They hold **synthetic data only**
and are never deployed to staging, pilot or production cells.

| File | Stands in for | Used by |
|---|---|---|
| `sim-bank-a-idp.json` | An institution's own identity provider over OpenID Connect (P3-R1 staff SSO) | Staff realm identity provider `sim-bank-a`, set up by `infra/keycloak/configure-tenant-sso.py` ([Phase 3 doc 07](../../../docs/phase-3/07-institution-staff-sso.md)) |
| `sim-bank-b-idp.json` | An institution's own identity provider over SAML 2.0 (P3-R1) | Staff realm identity provider `sim-bank-b`, same script |
| `sim-national-eid.json` | National eID (register entry I-01; scheme not chosen, question Q3-2) | `services/core` integrations module, port `NationalEid`, adapter `simulated-oidc` ([Phase 3 doc 06](../../../docs/phase-3/06-simulated-eid-identity-links.md)) |

Rules:
- Identities are created by the test or dev-cell script with random passwords; the user profile accepts only the
  synthetic identifier range of the country pack (`99xxxxxx`).
- The relying-party client secret is generated at start-up and given to the core as a file, never committed.
- The core refuses to run its eID adapter in any mode other than `simulated` while the register entry is class 3.
