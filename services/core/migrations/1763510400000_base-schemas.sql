-- Up Migration
-- O-DB1: empty base schemas for the platform modules (ADR-024). No tables, no data.
-- Tiers per Phase 0 §10.1: T0 special category, T1 high, T2 moderate, T3 public.
CREATE SCHEMA IF NOT EXISTS iam;
COMMENT ON SCHEMA iam IS 'identity-access module. Tier T1 (identifiers, encrypted fields). Tables from Phase 3. Owner: identity-access only (ADR-001).';
CREATE SCHEMA IF NOT EXISTS config;
COMMENT ON SCHEMA config IS 'country-config and tenant configuration. Tier T3 (no personal data). Rule-pack activations, feature-flag overrides.';
CREATE SCHEMA IF NOT EXISTS audit;
COMMENT ON SCHEMA audit IS 'consent-audit module. Tier T1 (metadata). Append-only, hash-chained audit events from Phase 3; moves to pg-consent-audit cluster (ADR-003).';

-- Down Migration
DROP SCHEMA IF EXISTS audit;
DROP SCHEMA IF EXISTS config;
DROP SCHEMA IF EXISTS iam;
