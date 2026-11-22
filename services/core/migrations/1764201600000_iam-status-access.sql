-- Up Migration
-- Customer access to the status page (P3-R2): case reference + one-time code to the contact on file. A challenge is
-- created for EVERY request, whether or not the reference exists (the answer never says), but a code is sent only to
-- a real contact and at most 3 times per reference in 15 minutes. A code works once, within 10 minutes, and a
-- challenge allows 5 attempts. Only digests are stored (reference, code). Functions only; no grant on the table.

CREATE TABLE iam.status_challenge (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_digest bytea NOT NULL CHECK (length(reference_digest) = 32),
  code_digest      bytea NOT NULL CHECK (length(code_digest) = 32),
  sent             boolean NOT NULL,
  attempts         integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  created_at       timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz NOT NULL,
  consumed_at      timestamptz,
  CHECK (expires_at > created_at AND expires_at <= created_at + interval '10 minutes')
);
CREATE INDEX status_challenge_reference ON iam.status_challenge (reference_digest, created_at);
COMMENT ON TABLE iam.status_challenge IS 'P3-R2. One-time codes for the customer status page (digests only).';
ALTER TABLE iam.status_challenge ENABLE ROW LEVEL SECURITY;   -- no policy and no grant: functions only

-- Records a challenge (id chosen by the core, so the code digest is bound to it); returns whether a code may be sent
-- now: a real contact, and the per-reference bound not reached.
CREATE FUNCTION iam.create_status_challenge(p_id uuid, p_reference_digest bytea, p_code_digest bytea, p_deliverable boolean) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, iam AS $$
DECLARE v_send boolean;
BEGIN
  v_send := p_deliverable AND (SELECT count(*) FROM iam.status_challenge c
                                WHERE c.reference_digest = p_reference_digest AND c.sent AND c.created_at > now() - interval '15 minutes') < 3;
  INSERT INTO iam.status_challenge (id, reference_digest, code_digest, sent, expires_at)
    VALUES (p_id, p_reference_digest, p_code_digest, v_send, now() + interval '10 minutes');
  RETURN v_send;
END $$;

-- True once for the right code of a sent, unexpired, unused challenge of this reference; every try counts.
CREATE FUNCTION iam.verify_status_challenge(p_id uuid, p_reference_digest bytea, p_code_digest bytea) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, iam AS $$
DECLARE c iam.status_challenge%ROWTYPE;
BEGIN
  SELECT * INTO c FROM iam.status_challenge WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR c.attempts >= 5 OR c.consumed_at IS NOT NULL OR c.expires_at <= now() THEN RETURN false; END IF;
  UPDATE iam.status_challenge SET attempts = attempts + 1 WHERE id = p_id;
  IF c.sent AND c.reference_digest = p_reference_digest AND c.code_digest = p_code_digest THEN
    UPDATE iam.status_challenge SET consumed_at = now() WHERE id = p_id;
    RETURN true;
  END IF;
  RETURN false;
END $$;

REVOKE ALL ON FUNCTION iam.create_status_challenge(uuid, bytea, bytea, boolean), iam.verify_status_challenge(uuid, bytea, bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION iam.create_status_challenge(uuid, bytea, bytea, boolean), iam.verify_status_challenge(uuid, bytea, bytea) TO civora_core_app;

-- Down Migration
DROP FUNCTION iam.verify_status_challenge(uuid, bytea, bytea);
DROP FUNCTION iam.create_status_challenge(uuid, bytea, bytea, boolean);
DROP TABLE iam.status_challenge;
