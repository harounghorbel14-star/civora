-- Up Migration
-- Identity links through the national eID (P3-D4 simulated adapter, P3-API6, P3-DB4). A citizen starts a link attempt
-- (single-use state, nonce and PKCE verifier, at most 15 minutes), authenticates at the eID, and the core records the
-- verified national identifier as a KEYED DIGEST in iam.identity_claim: never the value. One national identity links to
-- one person only. The application role reaches the attempts only through these functions.

CREATE TABLE iam.identity_link_attempt (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id     uuid NOT NULL REFERENCES iam.person(id) ON DELETE CASCADE,
  state_digest  bytea NOT NULL CHECK (length(state_digest) = 32),
  nonce         text CHECK (length(nonce) BETWEEN 32 AND 128),              -- erased when claimed
  code_verifier text CHECK (length(code_verifier) BETWEEN 43 AND 128),      -- erased when claimed
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  claimed_at    timestamptz,
  outcome       text CHECK (outcome IN ('linked', 'refreshed', 'rejected', 'linked-elsewhere', 'other-identity')),
  CHECK (expires_at > created_at AND expires_at <= created_at + interval '15 minutes'),
  CHECK ((claimed_at IS NULL) = (nonce IS NOT NULL AND code_verifier IS NOT NULL))
);
CREATE INDEX identity_link_attempt_person ON iam.identity_link_attempt (person_id, created_at);
COMMENT ON TABLE iam.identity_link_attempt IS 'P3-API6. A citizen''s attempt to link a national eID identity (single use, short-lived).';
ALTER TABLE iam.identity_link_attempt ENABLE ROW LEVEL SECURITY;   -- no policy and no grant: functions only

-- One person per national identity (whatever the source).
CREATE UNIQUE INDEX identity_claim_national_id_once ON iam.identity_claim (value_digest) WHERE claim_type = 'national-id-link';

CREATE FUNCTION iam.start_identity_link(p_state_digest bytea, p_nonce text, p_verifier text, p_ttl_seconds integer) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, iam AS $$
DECLARE v_id uuid;
BEGIN
  IF iam.current_person() IS NULL OR NOT EXISTS (SELECT 1 FROM iam.account WHERE person_id = iam.current_person() AND realm = 'citizens') THEN
    RAISE EXCEPTION 'citizens only' USING ERRCODE = '42501';
  END IF;
  IF p_ttl_seconds NOT BETWEEN 60 AND 900 THEN RAISE EXCEPTION 'attempt lifetime must be 60..900 s' USING ERRCODE = '22023'; END IF;
  IF (SELECT count(*) FROM iam.identity_link_attempt WHERE person_id = iam.current_person() AND created_at > now() - interval '1 hour') >= 5 THEN
    RAISE EXCEPTION 'too many identity link attempts in the last hour' USING ERRCODE = '53400';
  END IF;
  INSERT INTO iam.identity_link_attempt (person_id, state_digest, nonce, code_verifier, expires_at)
    VALUES (iam.current_person(), p_state_digest, p_nonce, p_verifier, now() + make_interval(secs => p_ttl_seconds)) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- Claims an open attempt of the caller with its state; returns its nonce and verifier ONCE and erases them.
CREATE FUNCTION iam.claim_identity_link(p_id uuid, p_state_digest bytea) RETURNS TABLE (nonce text, code_verifier text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, iam AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
    UPDATE iam.identity_link_attempt a SET claimed_at = now(), nonce = NULL, code_verifier = NULL
      FROM (SELECT x.id, x.nonce, x.code_verifier FROM iam.identity_link_attempt x
             WHERE x.id = p_id AND x.person_id = iam.current_person() AND x.state_digest = p_state_digest
               AND x.claimed_at IS NULL AND x.expires_at > now() FOR UPDATE) old
     WHERE a.id = old.id
    RETURNING old.nonce, old.code_verifier;
  IF NOT FOUND THEN RAISE EXCEPTION 'no such open link attempt' USING ERRCODE = 'P0002'; END IF;
END $$;

-- Records the outcome of a claimed attempt. p_digest NULL: the eID refused. Returns the outcome.
CREATE FUNCTION iam.finish_identity_link(p_id uuid, p_digest bytea, p_source text, p_loa text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, iam AS $$
DECLARE v_person uuid := iam.current_person(); v_outcome text;
BEGIN
  PERFORM 1 FROM iam.identity_link_attempt
   WHERE id = p_id AND person_id = v_person AND claimed_at > now() - interval '5 minutes' AND outcome IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no such claimed link attempt' USING ERRCODE = 'P0002'; END IF;
  IF p_digest IS NULL THEN
    v_outcome := 'rejected';
  ELSIF EXISTS (SELECT 1 FROM iam.identity_claim WHERE claim_type = 'national-id-link' AND value_digest = p_digest AND person_id <> v_person) THEN
    v_outcome := 'linked-elsewhere';
  ELSIF EXISTS (SELECT 1 FROM iam.identity_claim WHERE claim_type = 'national-id-link' AND person_id = v_person AND value_digest <> p_digest) THEN
    v_outcome := 'other-identity';
  ELSE
    BEGIN
      INSERT INTO iam.identity_claim (person_id, claim_type, value_digest, source, loa)
        VALUES (v_person, 'national-id-link', p_digest, p_source, p_loa)
      ON CONFLICT (person_id, claim_type, source) DO UPDATE SET loa = excluded.loa, verified_at = now()
      RETURNING CASE WHEN xmax = 0 THEN 'linked' ELSE 'refreshed' END INTO v_outcome;
    EXCEPTION WHEN unique_violation THEN
      v_outcome := 'linked-elsewhere';   -- another person linked the same identity at the same moment
    END;
  END IF;
  UPDATE iam.identity_link_attempt SET outcome = v_outcome WHERE id = p_id;
  RETURN v_outcome;
END $$;

REVOKE ALL ON FUNCTION iam.start_identity_link(bytea, text, text, integer), iam.claim_identity_link(uuid, bytea),
  iam.finish_identity_link(uuid, bytea, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION iam.start_identity_link(bytea, text, text, integer), iam.claim_identity_link(uuid, bytea),
  iam.finish_identity_link(uuid, bytea, text, text) TO civora_core_app;

-- Down Migration
DROP FUNCTION iam.finish_identity_link(uuid, bytea, text, text);
DROP FUNCTION iam.claim_identity_link(uuid, bytea);
DROP FUNCTION iam.start_identity_link(bytea, text, text, integer);
DROP INDEX iam.identity_claim_national_id_once;
DROP TABLE iam.identity_link_attempt;
