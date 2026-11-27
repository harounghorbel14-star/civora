-- Up Migration
-- Phase 4 (P4-DB1..DB5): the digital documents wallet in schema wallet. Owner: wallet module (ADR-001); no foreign key
-- into another module's schema (a person is referred to by the uuid the identity-access module gives it).
-- Tiers: issuers, credential types, verifiers and status lists hold no personal data (T3, published); the issuer's
-- record of what it issued and the holder's wallet entries are personal data (T1); the presentation log holds no
-- claim values and no person (T2). Doc phase-4/01.
-- Access model (as for iam, ADR-016): the application role civora_core_app owns nothing and is NOBYPASSRLS; it reads
-- the published tables, reads and writes only its caller's wallet entries (SET LOCAL app.person_id), appends to the
-- presentation log, and changes issuers, types, verifiers, issued credentials and status bits only through the
-- SECURITY DEFINER functions below, which check their input.

CREATE SCHEMA wallet;
COMMENT ON SCHEMA wallet IS 'wallet module (Phase 4): issuers, credential types, status lists, issued credentials, holder wallet entries, verifiers, presentation log. Owner: wallet only (ADR-001).';

CREATE FUNCTION wallet.current_person() RETURNS uuid
  LANGUAGE sql STABLE PARALLEL SAFE
  AS $$ SELECT nullif(current_setting('app.person_id', true), '')::uuid $$;

-- P4-DB1. A demo issuer (Q4-1: no real issuer until agreements exist). Its key lives in the HSM; only the public key
-- and the PKCS#11 reference (token label, key id) are here, from the key ceremony record (doc phase-4/02).
CREATE TABLE wallet.issuer (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  issuer_url       text NOT NULL UNIQUE CHECK (issuer_url ~ '^https://[a-z0-9.-]+(:[0-9]{1,5})?(/[A-Za-z0-9._~-]+)*$'),
  display          jsonb NOT NULL CHECK (display ?& ARRAY['ar', 'fr', 'en']),
  kind             text NOT NULL DEFAULT 'demo' CHECK (kind IN ('demo')),
  status           text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'retired')),
  kid              text NOT NULL UNIQUE CHECK (kid ~ '^[A-Za-z0-9._-]{1,64}$'),
  public_jwk       jsonb NOT NULL CHECK (public_jwk->>'kty' = 'EC' AND public_jwk->>'crv' = 'P-256' AND NOT public_jwk ? 'd'),
  hsm_token_label  text NOT NULL CHECK (length(hsm_token_label) BETWEEN 1 AND 32),
  hsm_key_id       text NOT NULL CHECK (hsm_key_id ~ '^[0-9a-f]{2,64}$'),
  created_at       timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE wallet.issuer IS 'P4-DB1. Demo issuers (synthetic credentials only, ADR-025). Public key and HSM reference; never a private key.';

-- P4-DB2. A credential type: its vct, its claims and which of them the holder may disclose one by one, validity,
-- the renewal service in the catalogue (P4-F6, Phase 5) and when to remind the holder before expiry (P4-D5).
CREATE TABLE wallet.credential_type (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issuer_id              uuid NOT NULL REFERENCES wallet.issuer(id),
  vct                    text NOT NULL UNIQUE CHECK (vct ~ '^urn:civora:tn:synthetic:[a-z0-9-]+:[0-9]+$'),
  display                jsonb NOT NULL CHECK (display ?& ARRAY['ar', 'fr', 'en']),
  claims                 text[] NOT NULL CHECK (cardinality(claims) BETWEEN 1 AND 40),
  selectively_disclosable text[] NOT NULL,
  validity_days          integer NOT NULL CHECK (validity_days BETWEEN 1 AND 3660),
  renewal_service_slug   text CHECK (renewal_service_slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  reminder_days          integer[] NOT NULL DEFAULT '{30,7}' CHECK (cardinality(reminder_days) BETWEEN 0 AND 4),
  status_bits            smallint NOT NULL DEFAULT 2 CHECK (status_bits IN (1, 2, 4, 8)),
  created_at             timestamptz NOT NULL DEFAULT now(),
  CHECK (array_to_string(claims, ',') ~ '^[a-z][a-z0-9_]*(/[a-z][a-z0-9_]*)?(,[a-z][a-z0-9_]*(/[a-z][a-z0-9_]*)?)*$'),
  CHECK (selectively_disclosable <@ claims),
  CHECK (NOT claims && ARRAY['iss', 'nbf', 'exp', 'iat', 'cnf', 'vct', 'status'])
);
COMMENT ON TABLE wallet.credential_type IS 'P4-DB2. Credential types (SD-JWT VC vct). Claims never include the processing claims (iss, exp, cnf, vct, status...).';

-- P4-DB4. Token Status List: the raw bit array (uncompressed here; compressed and signed when served, API6).
-- Each issuer has lists per bit width; indexes are given out at random (herd privacy, status list draft §12).
CREATE TABLE wallet.status_list (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  issuer_id   uuid NOT NULL REFERENCES wallet.issuer(id),
  bits        smallint NOT NULL CHECK (bits IN (1, 2, 4, 8)),
  size        integer NOT NULL CHECK (size BETWEEN 1024 AND 1048576 AND size % 1024 = 0),
  allocated   integer NOT NULL DEFAULT 0 CHECK (allocated BETWEEN 0 AND size),
  bitmap      bytea NOT NULL,
  version     bigint NOT NULL DEFAULT 1,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  full_since  timestamptz,
  CHECK (length(bitmap) = size * bits / 8)
);
COMMENT ON TABLE wallet.status_list IS 'P4-DB4. Status lists (draft-ietf-oauth-status-list): 0 valid, 1 invalid, 2 suspended. Index 0 = least significant bits of byte 0.';
CREATE INDEX ON wallet.status_list (issuer_id, bits) WHERE full_since IS NULL;

-- The issuer's record of what it issued: which status index belongs to which credential (revocation, P4-F5), for
-- whom (the subject, to list and revoke on request) and to which holder key (its RFC 7638 thumbprint, P4-SEC1).
-- The claims themselves are not kept: the issuer re-reads them from its source when it re-issues.
CREATE TABLE wallet.issued_credential (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issuer_id           uuid NOT NULL REFERENCES wallet.issuer(id),
  credential_type_id  uuid NOT NULL REFERENCES wallet.credential_type(id),
  subject_person_id   uuid NOT NULL,
  holder_jkt          text NOT NULL CHECK (holder_jkt ~ '^[A-Za-z0-9_-]{43}$'),
  status_list_id      bigint NOT NULL REFERENCES wallet.status_list(id),
  status_idx          integer NOT NULL CHECK (status_idx >= 0),
  status              text NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'suspended', 'revoked')),
  status_reason       text CHECK (status_reason IN ('holder-request', 'lost-device', 'data-changed', 'issued-in-error', 'under-review', 'review-cleared')),
  issued_at           timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz NOT NULL,
  status_changed_at   timestamptz,
  UNIQUE (status_list_id, status_idx),
  CHECK (expires_at > issued_at),
  CHECK ((status = 'valid' AND (status_reason IS NULL OR status_reason = 'review-cleared')) OR (status <> 'valid' AND status_reason IS NOT NULL))
);
COMMENT ON TABLE wallet.issued_credential IS 'Issuer side (P4-D1, P4-F5): status index, subject, holder key thumbprint, expiry, status. No claim values.';
CREATE INDEX ON wallet.issued_credential (subject_person_id);

CREATE TABLE wallet.issued_credential_event (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  issued_credential_id uuid NOT NULL REFERENCES wallet.issued_credential(id),
  action               text NOT NULL CHECK (action IN ('issued', 'suspended', 'revoked', 'reinstated')),
  reason               text,
  actor                text NOT NULL CHECK (actor ~ '^(holder|staff|issuer-system):[A-Za-z0-9-]{1,64}$'),
  at                   timestamptz NOT NULL DEFAULT clock_timestamp()
);
COMMENT ON TABLE wallet.issued_credential_event IS 'Append-only history of each issued credential (issued, suspended, revoked, reinstated).';
CREATE INDEX ON wallet.issued_credential_event (issued_credential_id, at);

-- P4-DB3. The holder's wallet entries kept by the cell: the credential itself only as a backup encrypted on the
-- device (the cell never holds the key), and the metadata needed to list it and remind before expiry (P4-D5).
CREATE TABLE wallet.credential (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id             uuid NOT NULL,
  vct                   text NOT NULL CHECK (length(vct) BETWEEN 3 AND 200),
  issuer_url            text NOT NULL CHECK (issuer_url ~ '^https://'),
  issued_at             timestamptz NOT NULL,
  expires_at            timestamptz NOT NULL,
  status_uri            text CHECK (status_uri ~ '^https://'),
  status_idx            integer CHECK (status_idx >= 0),
  backup_ciphertext     bytea CHECK (backup_ciphertext IS NULL OR length(backup_ciphertext) BETWEEN 29 AND 65536),
  backup_key_jkt        text CHECK (backup_key_jkt ~ '^[A-Za-z0-9_-]{43}$'),
  last_reminder_days    integer,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CHECK ((status_uri IS NULL) = (status_idx IS NULL)),
  CHECK ((backup_ciphertext IS NULL) = (backup_key_jkt IS NULL)),
  CHECK (expires_at > issued_at)
);
COMMENT ON TABLE wallet.credential IS 'P4-DB3. Holder wallet entries: metadata in clear (type, issuer, dates, status reference), the credential only as a device-encrypted backup (AES-GCM, key never sent).';
CREATE INDEX ON wallet.credential (person_id);
CREATE INDEX ON wallet.credential (expires_at);

-- Verifiers registered in the cell by an administrator (Q4-3 until a trust framework exists): what each may ask for,
-- and the public key its signed request objects are checked with.
CREATE TABLE wallet.verifier (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- A pre-registered client identifier (OpenID4VP 1.0 §5.9: no prefix): the cell is the registry (Q4-3).
  client_id       text NOT NULL UNIQUE CHECK (client_id ~ '^[a-z0-9][a-z0-9.-]{2,100}$'),
  display         jsonb NOT NULL CHECK (display ?& ARRAY['ar', 'fr', 'en']),
  request_jwk     jsonb NOT NULL CHECK (request_jwk->>'kty' = 'EC' AND request_jwk->>'crv' = 'P-256' AND NOT request_jwk ? 'd'),
  request_kid     text NOT NULL UNIQUE CHECK (request_kid ~ '^[A-Za-z0-9._-]{1,64}$'),
  hsm_token_label text NOT NULL CHECK (length(hsm_token_label) BETWEEN 1 AND 32),
  hsm_key_id      text NOT NULL CHECK (hsm_key_id ~ '^[0-9a-f]{2,64}$'),
  allowed_vct     text[] NOT NULL CHECK (cardinality(allowed_vct) BETWEEN 1 AND 20),
  allowed_claims  text[] NOT NULL CHECK (cardinality(allowed_claims) BETWEEN 0 AND 40),
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  tenant_id       uuid,
  created_at      timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE wallet.verifier IS 'Registered verifiers (Q4-3): pre-registered client_id, request-signing public key (private key in the HSM), credential types and claims they may request.';

-- P4-DB5. Presentation log at the verifier: outcome, reason, types and claim NAMES disclosed. Never claim values,
-- never the holder (P4-SEC4, ADR-011). Append-only.
CREATE TABLE wallet.presentation_log (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  verifier_id      uuid NOT NULL REFERENCES wallet.verifier(id),
  request_id       uuid NOT NULL,
  result           text NOT NULL CHECK (result IN ('accepted', 'rejected')),
  reason           text CHECK (reason ~ '^[a-z][a-z-]{1,40}$'),
  credential_types text[] NOT NULL DEFAULT '{}' CHECK (cardinality(credential_types) <= 10),
  disclosed_claims text[] NOT NULL DEFAULT '{}' CHECK (cardinality(disclosed_claims) <= 60),
  at               timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((result = 'accepted') = (reason IS NULL)),
  CHECK (array_to_string(disclosed_claims, ',') ~ '^([A-Za-z0-9_]+(/[A-Za-z0-9_]+)*(,[A-Za-z0-9_]+(/[A-Za-z0-9_]+)*)*)?$'),
  CHECK (array_to_string(credential_types, ',') ~ '^([A-Za-z0-9:._-]+(,[A-Za-z0-9:._-]+)*)?$')
);
COMMENT ON TABLE wallet.presentation_log IS 'P4-DB5. Verifier-side log: result, reason code, credential types, disclosed claim names only.';
CREATE INDEX ON wallet.presentation_log (verifier_id, at);

-- Row-level security where rows belong to a person.
ALTER TABLE wallet.credential              ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet.issued_credential       ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet.issued_credential_event ENABLE ROW LEVEL SECURITY;
CREATE POLICY credential_self ON wallet.credential FOR ALL
  USING (person_id = wallet.current_person()) WITH CHECK (person_id = wallet.current_person());
CREATE POLICY issued_subject ON wallet.issued_credential FOR SELECT USING (subject_person_id = wallet.current_person());
CREATE POLICY issued_event_subject ON wallet.issued_credential_event FOR SELECT
  USING (issued_credential_id IN (SELECT id FROM wallet.issued_credential WHERE subject_person_id = wallet.current_person()));

-- Set the value at idx in a status list's bit array (draft-ietf-oauth-status-list §4.1).
CREATE FUNCTION wallet.bitmap_set(bitmap bytea, bits integer, idx integer, val integer) RETURNS bytea
  LANGUAGE plpgsql IMMUTABLE STRICT SET search_path = pg_catalog AS $$
DECLARE
  pos integer := idx * bits;
  b integer := pos >> 3;
  shift integer := pos & 7;
  mask integer := ((1 << bits) - 1) << shift;
BEGIN
  IF val < 0 OR val >= (1 << bits) THEN RAISE EXCEPTION 'status value out of range' USING ERRCODE = '22003'; END IF;
  IF b >= length(bitmap) THEN RAISE EXCEPTION 'status index out of range' USING ERRCODE = '22003'; END IF;
  RETURN set_byte(bitmap, b, (get_byte(bitmap, b) & ~mask & 255) | (val << shift));
END $$;

CREATE FUNCTION wallet.bitmap_get(bitmap bytea, bits integer, idx integer) RETURNS integer
  LANGUAGE sql IMMUTABLE STRICT SET search_path = pg_catalog
  AS $$ SELECT (get_byte(bitmap, (idx * bits) >> 3) >> ((idx * bits) & 7)) & ((1 << bits) - 1) $$;

CREATE FUNCTION wallet.register_issuer(p_slug text, p_issuer_url text, p_display jsonb, p_kid text, p_public_jwk jsonb,
                                       p_token_label text, p_key_id text) RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, wallet AS $$
DECLARE r uuid;
BEGIN
  INSERT INTO wallet.issuer (slug, issuer_url, display, kid, public_jwk, hsm_token_label, hsm_key_id)
  VALUES (p_slug, p_issuer_url, p_display, p_kid,
          jsonb_build_object('kty', p_public_jwk->>'kty', 'crv', p_public_jwk->>'crv', 'x', p_public_jwk->>'x', 'y', p_public_jwk->>'y'),
          p_token_label, lower(p_key_id))
  RETURNING id INTO r;
  RETURN r;
END $$;

CREATE FUNCTION wallet.register_credential_type(p_issuer uuid, p_vct text, p_display jsonb, p_claims text[], p_sd text[],
                                                p_validity_days integer, p_renewal_service text, p_reminder_days integer[]) RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, wallet AS $$
DECLARE r uuid;
BEGIN
  INSERT INTO wallet.credential_type (issuer_id, vct, display, claims, selectively_disclosable, validity_days, renewal_service_slug, reminder_days)
  VALUES (p_issuer, p_vct, p_display, p_claims, p_sd, p_validity_days, p_renewal_service, coalesce(p_reminder_days, '{30,7}'))
  RETURNING id INTO r;
  RETURN r;
END $$;

CREATE FUNCTION wallet.register_verifier(p_client_id text, p_display jsonb, p_request_jwk jsonb, p_kid text, p_token_label text, p_key_id text,
                                         p_allowed_vct text[], p_allowed_claims text[], p_tenant uuid) RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, wallet AS $$
DECLARE r uuid;
BEGIN
  IF EXISTS (SELECT FROM unnest(p_allowed_vct) v WHERE v NOT IN (SELECT vct FROM wallet.credential_type)) THEN
    RAISE EXCEPTION 'unknown credential type' USING ERRCODE = '23503';
  END IF;
  INSERT INTO wallet.verifier (client_id, display, request_jwk, request_kid, hsm_token_label, hsm_key_id, allowed_vct, allowed_claims, tenant_id)
  VALUES (p_client_id, p_display,
          jsonb_build_object('kty', p_request_jwk->>'kty', 'crv', p_request_jwk->>'crv', 'x', p_request_jwk->>'x', 'y', p_request_jwk->>'y'),
          p_kid, p_token_label, lower(p_key_id), p_allowed_vct, p_allowed_claims, p_tenant)
  RETURNING id INTO r;
  RETURN r;
END $$;

-- Gives a new credential a random free index in its issuer's current list of the type's bit width (a new list when
-- the current one is 90 % full), and records the issuance. One issuance at a time per list (row lock).
CREATE FUNCTION wallet.record_issuance(p_type uuid, p_subject uuid, p_holder_jkt text, p_expires_at timestamptz, p_actor text,
                                       OUT issued_credential_id uuid, OUT status_list_id bigint, OUT status_idx integer)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, wallet AS $$
DECLARE
  t wallet.credential_type%ROWTYPE;
  l wallet.status_list%ROWTYPE;
  u bytea;
  candidate integer;
  tries integer := 0;
BEGIN
  SELECT * INTO t FROM wallet.credential_type ct WHERE ct.id = p_type;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown credential type' USING ERRCODE = '23503'; END IF;
  IF (SELECT i.status FROM wallet.issuer i WHERE i.id = t.issuer_id) <> 'active' THEN
    RAISE EXCEPTION 'issuer not active' USING ERRCODE = '55000';
  END IF;
  IF p_expires_at <= now() OR p_expires_at > now() + make_interval(days => t.validity_days) + interval '1 day' THEN
    RAISE EXCEPTION 'expiry outside the type''s validity' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO l FROM wallet.status_list sl
   WHERE sl.issuer_id = t.issuer_id AND sl.bits = t.status_bits AND sl.full_since IS NULL
   ORDER BY sl.id LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO wallet.status_list (issuer_id, bits, size, bitmap)
    VALUES (t.issuer_id, t.status_bits, 131072, decode(repeat('00', 131072 * t.status_bits / 8), 'hex'))
    RETURNING * INTO l;
  END IF;
  LOOP
    tries := tries + 1;
    u := uuid_send(gen_random_uuid());     -- bytes 0-3 of a version 4 UUID are random (strong source)
    candidate := (((get_byte(u, 0) & 127) << 24) | (get_byte(u, 1) << 16) | (get_byte(u, 2) << 8) | get_byte(u, 3)) % l.size;
    EXIT WHEN NOT EXISTS (SELECT FROM wallet.issued_credential ic WHERE ic.status_list_id = l.id AND ic.status_idx = candidate);
    IF tries > 64 THEN RAISE EXCEPTION 'no free status index' USING ERRCODE = '53000'; END IF;
  END LOOP;
  INSERT INTO wallet.issued_credential (issuer_id, credential_type_id, subject_person_id, holder_jkt, status_list_id, status_idx, expires_at)
  VALUES (t.issuer_id, t.id, p_subject, p_holder_jkt, l.id, candidate, p_expires_at)
  RETURNING id INTO issued_credential_id;
  INSERT INTO wallet.issued_credential_event (issued_credential_id, action, actor) VALUES (issued_credential_id, 'issued', p_actor);
  UPDATE wallet.status_list sl SET allocated = sl.allocated + 1,
         full_since = CASE WHEN sl.allocated + 1 >= sl.size * 9 / 10 THEN now() END
   WHERE sl.id = l.id;
  status_list_id := l.id;
  status_idx := candidate;
END $$;

-- Suspends, revokes or reinstates an issued credential and sets its bits. Revocation is final.
CREATE FUNCTION wallet.set_credential_status(p_issued uuid, p_status text, p_reason text, p_actor text) RETURNS bigint
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, wallet AS $$
DECLARE
  c wallet.issued_credential%ROWTYPE;
  l wallet.status_list%ROWTYPE;
  val integer;
BEGIN
  SELECT * INTO c FROM wallet.issued_credential ic WHERE ic.id = p_issued FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown credential' USING ERRCODE = '23503'; END IF;
  IF c.status = 'revoked' THEN RAISE EXCEPTION 'a revoked credential stays revoked' USING ERRCODE = '55000'; END IF;
  IF p_status = c.status THEN RAISE EXCEPTION 'no change' USING ERRCODE = '55000'; END IF;
  val := CASE p_status WHEN 'valid' THEN 0 WHEN 'revoked' THEN 1 WHEN 'suspended' THEN 2 END;
  IF val IS NULL THEN RAISE EXCEPTION 'unknown status' USING ERRCODE = '22023'; END IF;
  SELECT * INTO l FROM wallet.status_list sl WHERE sl.id = c.status_list_id FOR UPDATE;
  IF val >= (1 << l.bits) THEN RAISE EXCEPTION 'this list cannot hold that status' USING ERRCODE = '22023'; END IF;
  UPDATE wallet.issued_credential ic SET status = p_status, status_reason = p_reason, status_changed_at = now() WHERE ic.id = c.id;
  UPDATE wallet.status_list sl SET bitmap = wallet.bitmap_set(sl.bitmap, sl.bits, c.status_idx, val),
         version = sl.version + 1, updated_at = now()
   WHERE sl.id = l.id;
  INSERT INTO wallet.issued_credential_event (issued_credential_id, action, reason, actor)
  VALUES (c.id, CASE p_status WHEN 'valid' THEN 'reinstated' WHEN 'revoked' THEN 'revoked' ELSE 'suspended' END, p_reason, p_actor);
  RETURN l.version + 1;
END $$;

REVOKE ALL ON FUNCTION wallet.register_issuer(text, text, jsonb, text, jsonb, text, text),
  wallet.register_credential_type(uuid, text, jsonb, text[], text[], integer, text, integer[]),
  wallet.register_verifier(text, jsonb, jsonb, text, text, text, text[], text[], uuid),
  wallet.record_issuance(uuid, uuid, text, timestamptz, text),
  wallet.set_credential_status(uuid, text, text, text) FROM PUBLIC;
GRANT USAGE ON SCHEMA wallet TO civora_core_app;
GRANT SELECT ON wallet.issuer, wallet.credential_type, wallet.status_list, wallet.verifier TO civora_core_app;
GRANT SELECT ON wallet.issued_credential, wallet.issued_credential_event TO civora_core_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON wallet.credential TO civora_core_app;
GRANT SELECT, INSERT ON wallet.presentation_log TO civora_core_app;
GRANT EXECUTE ON FUNCTION wallet.current_person(), wallet.bitmap_get(bytea, integer, integer), wallet.bitmap_set(bytea, integer, integer, integer),
  wallet.register_issuer(text, text, jsonb, text, jsonb, text, text),
  wallet.register_credential_type(uuid, text, jsonb, text[], text[], integer, text, integer[]),
  wallet.register_verifier(text, jsonb, jsonb, text, text, text, text[], text[], uuid),
  wallet.record_issuance(uuid, uuid, text, timestamptz, text),
  wallet.set_credential_status(uuid, text, text, text) TO civora_core_app;

-- Down Migration
DROP SCHEMA wallet CASCADE;
