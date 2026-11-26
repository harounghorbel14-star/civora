-- Up Migration
-- Phase 3 gap G3 (ASVS 5.0 V8.2.4, V6.3.5; doc phase-3/15): adaptive controls on the device and browser a session is
-- used from. Devices a person has signed in from are remembered (keyed digests only, never a cookie or key itself),
-- and so is the context of each client session; a session whose device or browser changes is ended. The application
-- role reads its own rows; it writes only through iam.observe_session, which works on the current person.

CREATE TABLE iam.known_device (
  person_id   uuid NOT NULL REFERENCES iam.person(id) ON DELETE CASCADE,
  device      bytea NOT NULL CHECK (length(device) = 32),
  strength    text NOT NULL CHECK (strength IN ('device-cookie', 'device-key', 'browser')),
  label       text NOT NULL CHECK (length(label) BETWEEN 1 AND 60),
  first_seen  timestamptz NOT NULL DEFAULT now(),
  last_seen   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (person_id, device)
);
COMMENT ON TABLE iam.known_device IS 'Devices and browsers a person signed in from (keyed digest, coarse label such as "Chrome · Linux"); kept 400 days after last use.';

CREATE TABLE iam.session_context (
  session     bytea PRIMARY KEY CHECK (length(session) = 32),
  person_id   uuid NOT NULL REFERENCES iam.person(id) ON DELETE CASCADE,
  device      bytea NOT NULL CHECK (length(device) = 32),
  label       text NOT NULL CHECK (length(label) BETWEEN 1 AND 60),
  first_seen  timestamptz NOT NULL DEFAULT now(),
  last_seen   timestamptz NOT NULL DEFAULT now(),
  ended_at    timestamptz
);
COMMENT ON TABLE iam.session_context IS 'Device and browser of each client session (digest of realm, Keycloak session id and client); ended when they change. Kept 12 hours after last use.';
CREATE INDEX session_context_person ON iam.session_context (person_id);
CREATE INDEX session_context_last_seen ON iam.session_context (last_seen);
CREATE INDEX known_device_last_seen ON iam.known_device (last_seen);

ALTER TABLE iam.known_device ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.session_context ENABLE ROW LEVEL SECURITY;
CREATE POLICY known_device_self ON iam.known_device FOR SELECT USING (person_id = iam.current_person());
CREATE POLICY session_context_self ON iam.session_context FOR SELECT USING (person_id = iam.current_person());
GRANT SELECT ON iam.known_device, iam.session_context TO civora_core_app;

-- One call per request. Outcomes:
--   same            the session continues on the device and browser it started on
--   new-known       a new session on a device the person used before
--   new-device      a new session on a device not seen before (the person has other devices): notify
--   first-device    a new session and no device known yet (first sign-in, or all forgotten): no notice
--   changed-device  the session is now used from another device: end it
--   changed-browser the session is now used from another browser family on the same device: end it
--   ended           the session was ended before: refuse
-- long_absence: a new session after more than 180 days without any (V6.3.5: notify).
CREATE FUNCTION iam.observe_session(p_session bytea, p_device bytea, p_strength text, p_label text,
  OUT outcome text, OUT long_absence boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, iam AS $$
DECLARE
  v_me uuid := iam.current_person();
  v_row iam.session_context%ROWTYPE;
  v_known boolean;
  v_last timestamptz;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'no authenticated person' USING ERRCODE = '42501'; END IF;
  IF length(p_session) <> 32 OR length(p_device) <> 32 OR p_strength NOT IN ('device-cookie', 'device-key', 'browser')
     OR length(p_label) NOT BETWEEN 1 AND 60 THEN
    RAISE EXCEPTION 'invalid session context' USING ERRCODE = '22023';
  END IF;
  long_absence := false;
  -- Housekeeping, bounded per call: sessions last at most 8 hours; devices are forgotten after 400 days.
  DELETE FROM iam.session_context WHERE session IN (SELECT session FROM iam.session_context WHERE last_seen < now() - interval '12 hours' LIMIT 100);
  DELETE FROM iam.known_device d WHERE (d.person_id, d.device) IN
    (SELECT person_id, device FROM iam.known_device WHERE last_seen < now() - interval '400 days' LIMIT 100);

  INSERT INTO iam.session_context (session, person_id, device, label) VALUES (p_session, v_me, p_device, p_label)
    ON CONFLICT (session) DO NOTHING;
  IF FOUND THEN
    SELECT count(*) > 0, max(last_seen) INTO v_known, v_last FROM iam.known_device WHERE person_id = v_me;
    long_absence := v_last IS NOT NULL AND v_last < now() - interval '180 days';
    IF NOT v_known THEN
      outcome := 'first-device';
    ELSIF EXISTS (SELECT 1 FROM iam.known_device WHERE person_id = v_me AND device = p_device) THEN
      outcome := 'new-known';
    ELSE
      outcome := 'new-device';
    END IF;
    INSERT INTO iam.known_device (person_id, device, strength, label) VALUES (v_me, p_device, p_strength, p_label)
      ON CONFLICT (person_id, device) DO UPDATE SET last_seen = now(), label = excluded.label;
    -- At most 50 remembered devices per person: the least recently used go first.
    DELETE FROM iam.known_device d WHERE d.person_id = v_me AND d.device IN
      (SELECT device FROM iam.known_device WHERE person_id = v_me ORDER BY last_seen DESC OFFSET 50);
    RETURN;
  END IF;

  SELECT * INTO v_row FROM iam.session_context WHERE session = p_session FOR UPDATE;
  IF v_row.person_id <> v_me OR v_row.ended_at IS NOT NULL THEN
    outcome := 'ended';
  ELSIF v_row.device <> p_device THEN
    outcome := 'changed-device';
  ELSIF v_row.label <> p_label THEN
    outcome := 'changed-browser';
  ELSE
    outcome := 'same';
    IF v_row.last_seen < now() - interval '60 seconds' THEN
      UPDATE iam.session_context SET last_seen = now() WHERE session = p_session;
      UPDATE iam.known_device SET last_seen = now() WHERE person_id = v_me AND device = p_device;
    END IF;
    RETURN;
  END IF;
  IF outcome <> 'ended' THEN
    UPDATE iam.session_context SET ended_at = now(), last_seen = now() WHERE session = p_session;
  END IF;
END $$;
REVOKE ALL ON FUNCTION iam.observe_session(bytea, bytea, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION iam.observe_session(bytea, bytea, text, text) TO civora_core_app;

-- Down Migration
DROP FUNCTION iam.observe_session(bytea, bytea, text, text);
DROP TABLE iam.session_context;
DROP TABLE iam.known_device;
