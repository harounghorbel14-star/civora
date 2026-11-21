-- Up Migration
-- Registration requests (Phase 3, closing account enumeration): the core answers every registration the same way and
-- sends at most one activation e-mail per address per interval. Only a SHA-256 digest of the normalised address is
-- kept, for one day. The application role cannot read or change the table: it calls registration_permit().

CREATE TABLE iam.registration_request (
  email_digest bytea PRIMARY KEY CHECK (octet_length(email_digest) = 32),
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  sends integer NOT NULL DEFAULT 1 CHECK (sends > 0)
);
ALTER TABLE iam.registration_request ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE iam.registration_request IS 'Digest of addresses that asked to register, to bound activation e-mails; rows older than one day are deleted';

-- True when an activation e-mail may be sent now for this address; records the send. Atomic under concurrency.
CREATE FUNCTION iam.registration_permit(p_digest bytea, p_min_interval interval) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, iam AS $$
DECLARE
  v_ok boolean;
BEGIN
  IF p_digest IS NULL OR octet_length(p_digest) <> 32 THEN
    RAISE EXCEPTION 'digest must be 32 bytes' USING ERRCODE = '22023';
  END IF;
  IF p_min_interval < interval '1 minute' OR p_min_interval > interval '1 day' THEN
    RAISE EXCEPTION 'interval out of range' USING ERRCODE = '22023';
  END IF;
  DELETE FROM iam.registration_request WHERE last_sent_at < now() - interval '1 day';
  INSERT INTO iam.registration_request AS r (email_digest) VALUES (p_digest)
    ON CONFLICT (email_digest) DO UPDATE SET last_sent_at = now(), sends = r.sends + 1
    WHERE r.last_sent_at < now() - p_min_interval
  RETURNING true INTO v_ok;
  RETURN coalesce(v_ok, false);
END $$;
REVOKE ALL ON FUNCTION iam.registration_permit(bytea, interval) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION iam.registration_permit(bytea, interval) TO civora_core_app;

-- Down Migration
DROP FUNCTION iam.registration_permit(bytea, interval);
DROP TABLE iam.registration_request;
