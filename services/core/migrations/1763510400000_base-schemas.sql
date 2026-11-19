-- Up Migration
-- O-DB1: empty base schemas for the platform modules (ADR-024). No tables, no data.
-- Tier labels follow the data classification in docs/phase-2/05-data-architecture-and-governance.md.
CREATE SCHEMA IF NOT EXISTS iam;
COMMENT ON SCHEMA iam IS 'identity-access module. Tier T2 (personal data). Tables from Phase 3. Owner: identity-access only (ADR-001).';
CREATE SCHEMA IF NOT EXISTS config;
COMMENT ON SCHEMA config IS 'country-config and tenant configuration. Tier T0/T1 (no personal data). Rule-pack activations, feature-flag overrides.';
CREATE SCHEMA IF NOT EXISTS audit;
COMMENT ON SCHEMA audit IS 'consent-audit module. Tier T2. Append-only, hash-chained audit events from Phase 3; moves to pg-consent-audit cluster (ADR-008).';

-- Down Migration
DROP SCHEMA IF EXISTS audit;
DROP SCHEMA IF EXISTS config;
DROP SCHEMA IF EXISTS iam;
