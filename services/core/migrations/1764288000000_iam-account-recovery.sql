-- Up Migration
-- Phase 3 week 6 (P3-D5, P3-SEC4; doc phase-3/12): account recovery by re-proofing at the national eID (simulated in
-- Phase 3). Anyone may start an attempt (no account session: the person has lost their ways to sign in); the eID's
-- answer is matched to a linked identity by keyed digest only. The attempt keeps its outcome for audit and never a
-- national identifier. Functions only; no grant on the table.

CREATE TABLE iam.recovery_attempt (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_digest  bytea NOT NULL CHECK (length(state_digest) = 32),
  nonce         text CHECK (length(nonce) BETWEEN 32 AND 128),              -- erased when claimed
  code_verifier text CHECK (length(code_verifier) BETWEEN 43 AND 128),      -- erased when claimed
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  claimed_at    timestamptz,
  outcome       text CHECK (outcome IN ('recovered', 'no-account', 'level-too-low', 'limited', 'rejected')),
  person_id     uuid REFERENCES iam.person(id) ON DELETE SET NULL,          -- set only when recovered
  CHECK (expires_at > created_at AND expires_at <= created_at + interval '15 minutes'),
  CHECK ((claimed_at IS NULL) = (nonce IS NOT NULL AND code_verifier IS NOT NULL)),
  CHECK (person_id IS NULL OR outcome = 'recovered')
);
CREATE INDEX recovery_attempt_created ON iam.recovery_attempt (created_at);
CREATE INDEX recovery_attempt_person ON iam.recovery_attempt (person_id, created_at) WHERE person_id IS NOT NULL;
COMMENT ON TABLE iam.recovery_attempt IS 'P3-SEC4. Account recovery by re-proofing at the national eID (single use, short-lived; outcome kept for audit).';
ALTER TABLE iam.recovery_attempt ENABLE ROW LEVEL SECURITY;   -- no policy and no grant: functions only

CREATE FUNCTION iam.start_recovery(p_state_digest bytea, p_nonce text, p_verifier text, p_ttl_seconds integer) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, iam AS $$
DECLARE v_id uuid;
BEGIN
  IF p_ttl_seconds NOT BETWEEN 60 AND 900 THEN RAISE EXCEPTION 'attempt lifetime must be 60..900 s' USING ERRCODE = '22023'; END IF;
  -- The edge limits each client address; this bounds the whole cell (a distributed flood cannot fill the table).
  IF (SELECT count(*) FROM iam.recovery_attempt WHERE created_at > now() - interval '10 minutes') >= 2000 THEN
    RAISE EXCEPTION 'too many recovery attempts in the cell' USING ERRCODE = '53400';
  END IF;
  DELETE FROM iam.recovery_attempt WHERE created_at < now() - interval '90 days';
  INSERT INTO iam.recovery_attempt (state_digest, nonce, code_verifier, expires_at)
    VALUES (p_state_digest, p_nonce, p_verifier, now() + make_interval(secs => p_ttl_seconds)) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE FUNCTION iam.claim_recovery(p_id uuid, p_state_digest bytea) RETURNS TABLE (nonce text, code_verifier text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, iam AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
    UPDATE iam.recovery_attempt a SET claimed_at = now(), nonce = NULL, code_verifier = NULL
      FROM (SELECT x.id, x.nonce, x.code_verifier FROM iam.recovery_attempt x
             WHERE x.id = p_id AND x.state_digest = p_state_digest AND x.claimed_at IS NULL AND x.expires_at > now() FOR UPDATE) old
     WHERE a.id = old.id
    RETURNING old.nonce, old.code_verifier;
  IF NOT FOUND THEN RAISE EXCEPTION 'no such open recovery attempt' USING ERRCODE = 'P0002'; END IF;
END $$;

-- Decides the outcome of a claimed attempt from the eID's answer (keyed digest and level; NULL digest: the eID refused).
-- Recovery needs a linked national identity, an eID level at least that of the link (ASVS 5.0 V6.4.4: proofing at the
-- enrolment level) and at least "substantial", and at most 3 recoveries of one person in 24 hours.
CREATE FUNCTION iam.finish_recovery(p_id uuid, p_digest bytea, p_loa text)
RETURNS TABLE (outcome text, person_id uuid, subject text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, iam AS $$
#variable_conflict use_column
DECLARE
  v_person uuid; v_claim_loa text; v_subject text; v_outcome text;
  rank CONSTANT jsonb := '{"low": 1, "substantial": 2, "high": 3}';
BEGIN
  PERFORM 1 FROM iam.recovery_attempt
   WHERE id = p_id AND claimed_at > now() - interval '5 minutes' AND outcome IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no such claimed recovery attempt' USING ERRCODE = 'P0002'; END IF;
  IF p_digest IS NULL THEN
    v_outcome := 'rejected';
  ELSE
    SELECT c.person_id, c.loa INTO v_person, v_claim_loa FROM iam.identity_claim c
     WHERE c.claim_type = 'national-id-link' AND c.value_digest = p_digest;
    SELECT a.subject INTO v_subject FROM iam.account a WHERE a.person_id = v_person AND a.realm = 'citizens';
    IF v_person IS NULL OR v_subject IS NULL THEN
      v_outcome := 'no-account';
    ELSIF coalesce((rank ->> p_loa)::int, 0) < greatest((rank ->> v_claim_loa)::int, 2) THEN
      v_outcome := 'level-too-low';
    ELSIF (SELECT count(*) FROM iam.recovery_attempt r WHERE r.person_id = v_person AND r.created_at > now() - interval '24 hours') >= 3 THEN
      v_outcome := 'limited';
    ELSE
      v_outcome := 'recovered';
    END IF;
  END IF;
  UPDATE iam.recovery_attempt r SET outcome = v_outcome, person_id = CASE WHEN v_outcome = 'recovered' THEN v_person END WHERE r.id = p_id;
  RETURN QUERY SELECT v_outcome, CASE WHEN v_outcome = 'recovered' THEN v_person END, CASE WHEN v_outcome = 'recovered' THEN v_subject END;
END $$;

REVOKE ALL ON FUNCTION iam.start_recovery(bytea, text, text, integer), iam.claim_recovery(uuid, bytea), iam.finish_recovery(uuid, bytea, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION iam.start_recovery(bytea, text, text, integer), iam.claim_recovery(uuid, bytea), iam.finish_recovery(uuid, bytea, text) TO civora_core_app;

-- Down Migration
DROP FUNCTION iam.finish_recovery(uuid, bytea, text);
DROP FUNCTION iam.claim_recovery(uuid, bytea);
DROP FUNCTION iam.start_recovery(bytea, text, text, integer);
DROP TABLE iam.recovery_attempt;
