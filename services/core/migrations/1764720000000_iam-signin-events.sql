-- Up Migration
-- Phase 3 gap G1 (ASVS 5.0 V6.3.5, V6.3.7; doc phase-3/15 §7): the core reads Keycloak's sign-in events and tells the
-- person about suspicious attempts and changes to their ways of signing in. Each event is handled once, whichever core
-- replica reads it; failures are counted per account in a one-hour window; notices of the same kind are sent at most
-- once a day (failed attempts, a failed second step). Accounts are keyed digests (realm + Keycloak user id), never ids.
-- Functions only: the application role has no grant on the tables.

CREATE TABLE iam.signin_event_seen (
  event      bytea PRIMARY KEY CHECK (length(event) = 32),
  expires_at timestamptz NOT NULL
);
COMMENT ON TABLE iam.signin_event_seen IS 'Keycloak sign-in events already handled (digest of realm and event id), kept two hours.';

CREATE TABLE iam.signin_watch (
  account           bytea PRIMARY KEY CHECK (length(account) = 32),
  failures          integer NOT NULL DEFAULT 0 CHECK (failures >= 0),
  window_start      timestamptz,
  failed_notice_at  timestamptz,
  partial_notice_at timestamptz,
  updated_at        timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE iam.signin_watch IS 'Failed sign-ins per account (keyed digest) in a one-hour window, and when notices were last sent; kept two days.';
CREATE INDEX signin_watch_updated ON iam.signin_watch (updated_at);
CREATE INDEX signin_event_seen_expires ON iam.signin_event_seen (expires_at);

ALTER TABLE iam.signin_event_seen ENABLE ROW LEVEL SECURITY;   -- no policy and no grant: functions only
ALTER TABLE iam.signin_watch ENABLE ROW LEVEL SECURITY;

-- p_kind: failure | second-factor-failure | success | credential-change; p_at: the event's time.
-- notice: duplicate (already handled) | null (nothing to send) | failed-attempts | second-factor-failed |
--         signed-in-after-failures | credential-change; failures: failed attempts counted in the window.
CREATE FUNCTION iam.record_signin_event(p_event bytea, p_account bytea, p_kind text, p_at timestamptz,
  OUT notice text, OUT failures integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, iam AS $$
DECLARE
  w iam.signin_watch%ROWTYPE;
  v_count integer;
BEGIN
  IF length(p_event) <> 32 OR length(p_account) <> 32
     OR p_kind NOT IN ('failure', 'second-factor-failure', 'success', 'credential-change') THEN
    RAISE EXCEPTION 'invalid sign-in event' USING ERRCODE = '22023';
  END IF;
  DELETE FROM iam.signin_event_seen WHERE event IN (SELECT event FROM iam.signin_event_seen WHERE expires_at < now() LIMIT 500);
  DELETE FROM iam.signin_watch WHERE account IN (SELECT account FROM iam.signin_watch WHERE updated_at < now() - interval '2 days' LIMIT 200);

  INSERT INTO iam.signin_event_seen (event, expires_at) VALUES (p_event, now() + interval '2 hours') ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN notice := 'duplicate'; failures := 0; RETURN; END IF;
  notice := NULL;
  IF p_kind = 'credential-change' THEN notice := 'credential-change'; failures := 0; RETURN; END IF;

  INSERT INTO iam.signin_watch (account) VALUES (p_account) ON CONFLICT DO NOTHING;
  SELECT * INTO w FROM iam.signin_watch WHERE account = p_account FOR UPDATE;
  IF w.window_start IS NULL OR w.window_start < p_at - interval '1 hour' THEN
    w.failures := 0;
    w.window_start := p_at;
  END IF;

  IF p_kind = 'success' THEN
    failures := w.failures;
    IF w.failures >= 3 THEN notice := 'signed-in-after-failures'; END IF;
    UPDATE iam.signin_watch SET failures = 0, window_start = NULL, updated_at = now() WHERE account = p_account;
    RETURN;
  END IF;

  v_count := w.failures + 1;
  failures := v_count;
  IF p_kind = 'second-factor-failure' AND (w.partial_notice_at IS NULL OR w.partial_notice_at < now() - interval '1 day') THEN
    notice := 'second-factor-failed';
    w.partial_notice_at := now();
  ELSIF v_count >= 5 AND (w.failed_notice_at IS NULL OR w.failed_notice_at < now() - interval '1 day') THEN
    notice := 'failed-attempts';
    w.failed_notice_at := now();
  END IF;
  UPDATE iam.signin_watch SET failures = v_count, window_start = w.window_start, failed_notice_at = w.failed_notice_at,
    partial_notice_at = w.partial_notice_at, updated_at = now() WHERE account = p_account;
END $$;
REVOKE ALL ON FUNCTION iam.record_signin_event(bytea, bytea, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION iam.record_signin_event(bytea, bytea, text, timestamptz) TO civora_core_app;

-- Down Migration
DROP FUNCTION iam.record_signin_event(bytea, bytea, text, timestamptz);
DROP TABLE iam.signin_watch;
DROP TABLE iam.signin_event_seen;
