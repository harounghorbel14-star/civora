-- Up Migration
-- Phase 3 (P3-DB1..DB6): identity and mandates in schema iam (tier T1). Owner: identity-access module (ADR-001).
-- Access model (ADR-016, doc 06):
--   * the application role civora_core_app (NOBYPASSRLS, owns nothing) reads only rows of the person set for the
--     transaction (SET LOCAL app.person_id, from a verified token), and may change only its own preferences;
--   * every other change goes through SECURITY DEFINER functions that check the caller, the state and the input,
--     and write an append-only event; the application role has no INSERT/UPDATE/DELETE on mandates or events.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'civora_core_app') THEN
    IF (SELECT rolsuper OR rolcreaterole FROM pg_roles WHERE rolname = current_user) THEN
      BEGIN
        CREATE ROLE civora_core_app NOLOGIN NOBYPASSRLS;   -- development cells only; staging and production create it (Ansible)
      EXCEPTION WHEN duplicate_object THEN NULL;           -- created concurrently (parallel test databases)
      END;
    ELSE
      RAISE EXCEPTION 'role civora_core_app is missing: create it with the database role (postgresql_ha) before migrating';
    END IF;
  END IF;
END $$;

-- The person set for the current transaction, or NULL (then every policy below matches nothing).
CREATE FUNCTION iam.current_person() RETURNS uuid
  LANGUAGE sql STABLE PARALLEL SAFE
  AS $$ SELECT nullif(current_setting('app.person_id', true), '')::uuid $$;

CREATE TABLE iam.person (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preferred_locale text NOT NULL DEFAULT 'ar-TN' CHECK (preferred_locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  accessibility    jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(accessibility) = 'object'),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE iam.person IS 'P3-DB1. A natural person known to the cell. No name or national identifier here (claims live in iam.identity_claim).';

CREATE TABLE iam.account (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id       uuid NOT NULL REFERENCES iam.person(id) ON DELETE CASCADE,
  realm           text NOT NULL CHECK (realm IN ('citizens', 'staff')),
  tenant_id       uuid,
  subject         text NOT NULL CHECK (length(subject) BETWEEN 1 AND 255),
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
  assurance_level text NOT NULL DEFAULT 'AAL1' CHECK (assurance_level IN ('AAL1', 'AAL2', 'AAL3')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (realm, subject),
  CHECK ((realm = 'staff') = (tenant_id IS NOT NULL))          -- staff belong to an institution; citizens do not
);
COMMENT ON TABLE iam.account IS 'P3-DB2. A login account in a Keycloak realm of this cell (subject = Keycloak user id, never shown to apps).';

CREATE TABLE iam.authenticator (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id             uuid NOT NULL REFERENCES iam.account(id) ON DELETE CASCADE,
  kind                   text NOT NULL CHECK (kind IN ('passkey', 'security-key', 'totp', 'sms')),
  label                  text CHECK (length(label) <= 64),
  keycloak_credential_id text NOT NULL UNIQUE,
  created_at             timestamptz NOT NULL DEFAULT now(),
  last_used_at           timestamptz
);
COMMENT ON TABLE iam.authenticator IS 'P3-DB3. Mirror of Keycloak credentials (metadata only; secrets stay in Keycloak).';

CREATE TABLE iam.identity_claim (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id    uuid NOT NULL REFERENCES iam.person(id) ON DELETE CASCADE,
  claim_type   text NOT NULL CHECK (claim_type IN ('national-id-link', 'phone', 'email', 'legal-name')),
  value_digest bytea NOT NULL CHECK (length(value_digest) = 32),   -- keyed digest; the value itself is not stored here
  source       text NOT NULL CHECK (source IN ('eid-simulated', 'self-asserted', 'staff-verified')),
  loa          text NOT NULL CHECK (loa IN ('low', 'substantial', 'high')),
  verified_at  timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz,
  UNIQUE (person_id, claim_type, source)
);
COMMENT ON TABLE iam.identity_claim IS 'P3-DB4. Verified identity claims (Phase 3: simulated national eID only).';

CREATE TABLE iam.pairwise_id (
  person_id    uuid NOT NULL REFERENCES iam.person(id) ON DELETE CASCADE,
  sector       text NOT NULL CHECK (sector ~ '^[a-z0-9][a-z0-9.-]{0,62}$'),
  pairwise_sub text NOT NULL UNIQUE CHECK (length(pairwise_sub) BETWEEN 16 AND 128),
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (person_id, sector)
);
COMMENT ON TABLE iam.pairwise_id IS 'P3-DB6. Pairwise subject per relying-party sector (P3-A3), so two services cannot link a citizen by identifier.';

CREATE TABLE iam.mandate (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_id           uuid NOT NULL REFERENCES iam.person(id),
  agent_id               uuid REFERENCES iam.person(id),
  scopes                 text[] NOT NULL,
  status                 text NOT NULL CHECK (status IN ('proposed', 'active', 'revoked')),
  valid_from             timestamptz NOT NULL,
  expires_at             timestamptz NOT NULL,
  invitation_code_digest bytea CHECK (invitation_code_digest IS NULL OR length(invitation_code_digest) = 32),
  created_at             timestamptz NOT NULL DEFAULT now(),
  accepted_at            timestamptz,
  revoked_at             timestamptz,
  revoked_by             uuid REFERENCES iam.person(id),
  CHECK (cardinality(scopes) BETWEEN 1 AND 20),
  CHECK (array_to_string(scopes, ',') ~ '^[a-z][a-z-]*:(read|submit|manage)(,[a-z][a-z-]*:(read|submit|manage))*$'),
  CHECK (expires_at > valid_from AND expires_at <= valid_from + interval '366 days'),
  CHECK (agent_id IS NULL OR agent_id <> principal_id),
  CHECK ((status = 'proposed') = (agent_id IS NULL))
);
COMMENT ON TABLE iam.mandate IS 'P3-DB5. Mandate: an agent may act for a principal within scopes until expiry (P3-F5). "expired" is derived from expires_at.';

CREATE TABLE iam.mandate_event (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mandate_id uuid NOT NULL REFERENCES iam.mandate(id),
  actor_id   uuid NOT NULL REFERENCES iam.person(id),
  action     text NOT NULL CHECK (action IN ('created', 'accepted', 'revoked', 'renounced')),
  at         timestamptz NOT NULL DEFAULT clock_timestamp()
);
COMMENT ON TABLE iam.mandate_event IS 'P3-AC3. Append-only log of mandate actions, visible to the principal and the agent.';

CREATE INDEX ON iam.account (person_id);
CREATE INDEX ON iam.authenticator (account_id);
CREATE INDEX ON iam.mandate (principal_id);
CREATE INDEX ON iam.mandate (agent_id);
CREATE INDEX ON iam.mandate_event (mandate_id, at);

-- Row-level security on every table. The owner (migrator) is used only for migrations and the definer functions
-- below, which therefore see all rows; the application role owns nothing and is always filtered.
ALTER TABLE iam.person         ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.account        ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.authenticator  ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.identity_claim ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.pairwise_id    ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.mandate        ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.mandate_event  ENABLE ROW LEVEL SECURITY;

CREATE POLICY person_self ON iam.person FOR ALL USING (id = iam.current_person()) WITH CHECK (id = iam.current_person());
CREATE POLICY account_self ON iam.account FOR SELECT USING (person_id = iam.current_person());
CREATE POLICY authenticator_self ON iam.authenticator FOR SELECT
  USING (account_id IN (SELECT id FROM iam.account WHERE person_id = iam.current_person()));
CREATE POLICY claim_self ON iam.identity_claim FOR SELECT USING (person_id = iam.current_person());
CREATE POLICY pairwise_self ON iam.pairwise_id FOR SELECT USING (person_id = iam.current_person());
CREATE POLICY mandate_parties ON iam.mandate FOR SELECT
  USING (principal_id = iam.current_person() OR agent_id = iam.current_person());
CREATE POLICY mandate_event_parties ON iam.mandate_event FOR SELECT
  USING (mandate_id IN (SELECT id FROM iam.mandate));   -- the subquery is itself filtered by mandate_parties

-- Definer functions: run as the owner, so they see all rows; each checks the caller itself.
-- First authenticated request of an account: find or create its person (just-in-time provisioning).
CREATE FUNCTION iam.ensure_person(p_realm text, p_subject text, p_tenant uuid, p_locale text) RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, iam AS $$
DECLARE v_person uuid;
BEGIN
  SELECT a.person_id INTO v_person FROM iam.account a WHERE a.realm = p_realm AND a.subject = p_subject;
  IF v_person IS NULL THEN
    INSERT INTO iam.person (preferred_locale) VALUES (coalesce(p_locale, 'ar-TN')) RETURNING id INTO v_person;
    INSERT INTO iam.account (person_id, realm, tenant_id, subject) VALUES (v_person, p_realm, p_tenant, p_subject);
  END IF;
  RETURN v_person;
END $$;

CREATE FUNCTION iam.create_mandate(p_scopes text[], p_valid_from timestamptz, p_expires_at timestamptz, p_code_digest bytea)
  RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, iam AS $$
DECLARE v_me uuid := iam.current_person(); v_id uuid;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'no authenticated person' USING ERRCODE = '42501'; END IF;
  INSERT INTO iam.mandate (principal_id, scopes, status, valid_from, expires_at, invitation_code_digest)
    VALUES (v_me, p_scopes, 'proposed', p_valid_from, p_expires_at, p_code_digest) RETURNING id INTO v_id;
  INSERT INTO iam.mandate_event (mandate_id, actor_id, action) VALUES (v_id, v_me, 'created');
  RETURN v_id;
END $$;

-- The agent proves possession of the invitation code; the principal cannot accept their own mandate.
CREATE FUNCTION iam.accept_mandate(p_id uuid, p_code_digest bytea) RETURNS boolean
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, iam AS $$
DECLARE v_me uuid := iam.current_person(); v_updated int;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'no authenticated person' USING ERRCODE = '42501'; END IF;
  UPDATE iam.mandate SET agent_id = v_me, status = 'active', accepted_at = now(), invitation_code_digest = NULL
   WHERE id = p_id AND status = 'proposed' AND principal_id <> v_me AND expires_at > now()
     AND invitation_code_digest = p_code_digest;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 1 THEN
    INSERT INTO iam.mandate_event (mandate_id, actor_id, action) VALUES (p_id, v_me, 'accepted');
  END IF;
  RETURN v_updated = 1;
END $$;

-- Either party ends the mandate: the principal revokes it, the agent renounces it.
CREATE FUNCTION iam.revoke_mandate(p_id uuid) RETURNS boolean
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, iam AS $$
DECLARE v_me uuid := iam.current_person(); v_principal uuid; v_agent uuid;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'no authenticated person' USING ERRCODE = '42501'; END IF;
  SELECT principal_id, agent_id INTO v_principal, v_agent FROM iam.mandate
   WHERE id = p_id AND status IN ('proposed', 'active') AND (principal_id = v_me OR agent_id = v_me) FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE iam.mandate SET status = 'revoked', revoked_at = now(), revoked_by = v_me, invitation_code_digest = NULL WHERE id = p_id;
  INSERT INTO iam.mandate_event (mandate_id, actor_id, action)
    VALUES (p_id, v_me, CASE WHEN v_me = v_principal THEN 'revoked' ELSE 'renounced' END);
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION iam.ensure_person(text, text, uuid, text), iam.create_mandate(text[], timestamptz, timestamptz, bytea),
  iam.accept_mandate(uuid, bytea), iam.revoke_mandate(uuid) FROM PUBLIC;
GRANT USAGE ON SCHEMA iam TO civora_core_app;
GRANT EXECUTE ON FUNCTION iam.current_person(), iam.ensure_person(text, text, uuid, text),
  iam.create_mandate(text[], timestamptz, timestamptz, bytea), iam.accept_mandate(uuid, bytea), iam.revoke_mandate(uuid)
  TO civora_core_app;
GRANT SELECT ON iam.person, iam.account, iam.authenticator, iam.identity_claim, iam.pairwise_id, iam.mandate, iam.mandate_event
  TO civora_core_app;
GRANT UPDATE (preferred_locale, accessibility, updated_at) ON iam.person TO civora_core_app;

-- Down Migration
DROP FUNCTION IF EXISTS iam.revoke_mandate(uuid);
DROP FUNCTION IF EXISTS iam.accept_mandate(uuid, bytea);
DROP FUNCTION IF EXISTS iam.create_mandate(text[], timestamptz, timestamptz, bytea);
DROP FUNCTION IF EXISTS iam.ensure_person(text, text, uuid, text);
DROP TABLE IF EXISTS iam.mandate_event;
DROP TABLE IF EXISTS iam.mandate;
DROP TABLE IF EXISTS iam.pairwise_id;
DROP TABLE IF EXISTS iam.identity_claim;
DROP TABLE IF EXISTS iam.authenticator;
DROP TABLE IF EXISTS iam.account;
DROP TABLE IF EXISTS iam.person;
DROP FUNCTION IF EXISTS iam.current_person();
