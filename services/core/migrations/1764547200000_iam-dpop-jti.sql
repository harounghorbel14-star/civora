-- Up Migration
-- Phase 3 (ASVS 5.0 V10.3.5; doc phase-3/14): identifiers of DPoP proofs already used, so a captured proof cannot be
-- replayed while it is fresh (60 s either side). Shared by every core replica; digests only; functions only.

CREATE TABLE iam.dpop_jti (
  digest     bytea PRIMARY KEY CHECK (length(digest) = 32),
  expires_at timestamptz NOT NULL
);
COMMENT ON TABLE iam.dpop_jti IS 'DPoP proof identifiers already used (RFC 9449 replay protection), kept until the proof could no longer be fresh.';
ALTER TABLE iam.dpop_jti ENABLE ROW LEVEL SECURITY;   -- no policy and no grant: functions only

CREATE FUNCTION iam.claim_dpop_jti(p_digest bytea, p_ttl_seconds integer) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, iam AS $$
BEGIN
  IF p_ttl_seconds NOT BETWEEN 1 AND 600 THEN RAISE EXCEPTION 'lifetime must be 1..600 s' USING ERRCODE = '22023'; END IF;
  DELETE FROM iam.dpop_jti WHERE ctid IN (SELECT ctid FROM iam.dpop_jti WHERE expires_at < now() LIMIT 200);
  -- Fresh when new, or when the earlier use has expired but was not swept yet; a replay inside the window: false.
  INSERT INTO iam.dpop_jti AS d (digest, expires_at) VALUES (p_digest, now() + make_interval(secs => p_ttl_seconds))
    ON CONFLICT (digest) DO UPDATE SET expires_at = EXCLUDED.expires_at WHERE d.expires_at < now();
  RETURN FOUND;
END $$;

REVOKE ALL ON FUNCTION iam.claim_dpop_jti(bytea, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION iam.claim_dpop_jti(bytea, integer) TO civora_core_app;

-- Down Migration
DROP FUNCTION iam.claim_dpop_jti(bytea, integer);
DROP TABLE iam.dpop_jti;
