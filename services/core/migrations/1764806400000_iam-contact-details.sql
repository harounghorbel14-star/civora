-- Up Migration
-- Phase 3 (decisions of 27 Nov 2026; doc phase-3/16): the account's e-mail address and phone number change only through
-- the core, and only once a code sent to the NEW address or number is typed back (ASVS 5.0 V6.3.7: the old address is
-- told). A citizen whose phone number is verified can recover the account with the e-mail link AND an SMS code (R4).
-- Accounts are keyed digests of realm and Keycloak user id. Functions only: the application role has no grant on the
-- tables.

CREATE TABLE iam.contact_change (
  id           uuid PRIMARY KEY,
  account      bytea NOT NULL CHECK (length(account) = 32),
  channel      text NOT NULL CHECK (channel IN ('email', 'phone')),
  target       text CHECK (length(target) <= 320),        -- the new address or number until confirmed; then cleared
  code_digest  bytea NOT NULL CHECK (length(code_digest) = 32),
  attempts     integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  confirmed_at timestamptz
);
CREATE INDEX contact_change_account ON iam.contact_change (account, created_at);
CREATE INDEX contact_change_created ON iam.contact_change (created_at);
COMMENT ON TABLE iam.contact_change IS 'A change of e-mail address or phone number waiting for the code sent to the new one (10 minutes, 5 tries); rows kept two days for the daily limit.';
ALTER TABLE iam.contact_change ENABLE ROW LEVEL SECURITY;   -- no policy and no grant: functions only

-- false when the account already started 5 changes in the last 24 hours. Any other open change of the same channel ends.
CREATE FUNCTION iam.start_contact_change(p_id uuid, p_account bytea, p_channel text, p_target text, p_code_digest bytea, p_minutes integer)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, iam AS $$
BEGIN
  IF length(p_account) <> 32 OR length(p_code_digest) <> 32 OR p_channel NOT IN ('email', 'phone')
     OR p_target IS NULL OR length(p_target) > 320 OR p_minutes NOT BETWEEN 1 AND 60 THEN
    RAISE EXCEPTION 'invalid contact change' USING ERRCODE = '22023';
  END IF;
  DELETE FROM iam.contact_change WHERE id IN (SELECT id FROM iam.contact_change WHERE created_at < now() - interval '2 days' LIMIT 200);
  PERFORM pg_advisory_xact_lock(hashtextextended(encode(p_account, 'hex'), 0));
  IF (SELECT count(*) FROM iam.contact_change WHERE account = p_account AND created_at > now() - interval '24 hours') >= 5 THEN
    RETURN false;
  END IF;
  UPDATE iam.contact_change SET target = NULL, expires_at = least(expires_at, now())
   WHERE account = p_account AND channel = p_channel AND confirmed_at IS NULL AND expires_at > now();
  INSERT INTO iam.contact_change (id, account, channel, target, code_digest, expires_at)
  VALUES (p_id, p_account, p_channel, p_target, p_code_digest, now() + make_interval(mins => p_minutes));
  RETURN true;
END $$;

-- outcome: confirmed (with channel and target) | wrong-code (attempts_left > 0) | not-found (no such open change of
-- this account: unknown, expired, already used, replaced, or out of tries; not distinguished).
CREATE FUNCTION iam.confirm_contact_change(p_id uuid, p_account bytea, p_code_digest bytea,
  OUT outcome text, OUT channel text, OUT target text, OUT attempts_left integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, iam AS $$
DECLARE
  c iam.contact_change%ROWTYPE;
BEGIN
  IF length(p_account) <> 32 OR length(p_code_digest) <> 32 THEN
    RAISE EXCEPTION 'invalid contact change' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO c FROM iam.contact_change x
   WHERE x.id = p_id AND x.account = p_account AND x.confirmed_at IS NULL AND x.expires_at > now() AND x.attempts < 5 AND x.target IS NOT NULL
   FOR UPDATE;
  IF NOT FOUND THEN outcome := 'not-found'; attempts_left := 0; RETURN; END IF;
  IF c.code_digest <> p_code_digest THEN
    UPDATE iam.contact_change x SET attempts = x.attempts + 1, target = CASE WHEN x.attempts + 1 >= 5 THEN NULL ELSE x.target END WHERE x.id = p_id;
    outcome := 'wrong-code'; attempts_left := 4 - c.attempts;
    IF attempts_left <= 0 THEN outcome := 'not-found'; attempts_left := 0; END IF;
    RETURN;
  END IF;
  UPDATE iam.contact_change x SET confirmed_at = now(), target = NULL WHERE x.id = p_id;
  outcome := 'confirmed'; channel := c.channel; target := c.target; attempts_left := 0;
END $$;

CREATE TABLE iam.contact_recovery (
  id           uuid PRIMARY KEY,
  email_digest bytea NOT NULL CHECK (length(email_digest) = 32),
  account      bytea NOT NULL CHECK (length(account) = 32),
  subject      text CHECK (length(subject) <= 64),          -- Keycloak user id until the attempt ends; then cleared
  phone        text CHECK (length(phone) <= 20),            -- the verified number at the start; then cleared
  lang         text NOT NULL CHECK (lang IN ('ar', 'fr', 'en')),
  link_digest  bytea NOT NULL CHECK (length(link_digest) = 32),
  code_digest  bytea CHECK (length(code_digest) = 32),
  codes_sent   integer NOT NULL DEFAULT 0 CHECK (codes_sent >= 0),
  attempts     integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  code_expires_at timestamptz,
  completed_at timestamptz
);
CREATE INDEX contact_recovery_email ON iam.contact_recovery (email_digest, created_at);
CREATE INDEX contact_recovery_account ON iam.contact_recovery (account, created_at);
CREATE INDEX contact_recovery_created ON iam.contact_recovery (created_at);
COMMENT ON TABLE iam.contact_recovery IS 'Recovery R4: e-mailed link (30 minutes) then an SMS code to the verified phone (10 minutes, 3 codes, 5 tries); outcome kept 90 days. A row without a phone is the advice e-mail sent to an account without a verified number (counted by the same limits).';
ALTER TABLE iam.contact_recovery ENABLE ROW LEVEL SECURITY;   -- no policy and no grant: functions only

-- false when limited: a link (or advice) went to this address in the last 15 minutes, the account was recovered 3 times
-- in 24 hours, or the cell is flooded (2000 attempts in 10 minutes). The caller then sends nothing (its answer is the
-- same anyway). Without a phone (p_phone null), the row only records the advice e-mail: it can never be completed.
CREATE FUNCTION iam.start_contact_recovery(p_id uuid, p_email_digest bytea, p_account bytea, p_subject text, p_phone text, p_lang text,
  p_link_digest bytea, p_minutes integer)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, iam AS $$
BEGIN
  IF length(p_email_digest) <> 32 OR length(p_account) <> 32 OR length(p_link_digest) <> 32 OR p_subject IS NULL
     OR length(p_subject) > 64 OR length(p_phone) > 20 OR p_lang NOT IN ('ar', 'fr', 'en') OR p_minutes NOT BETWEEN 5 AND 60 THEN
    RAISE EXCEPTION 'invalid contact recovery' USING ERRCODE = '22023';
  END IF;
  DELETE FROM iam.contact_recovery WHERE id IN (SELECT id FROM iam.contact_recovery WHERE created_at < now() - interval '90 days' LIMIT 200);
  UPDATE iam.contact_recovery SET subject = NULL, phone = NULL
   WHERE id IN (SELECT id FROM iam.contact_recovery WHERE subject IS NOT NULL AND expires_at < now() - interval '1 hour' LIMIT 200);
  PERFORM pg_advisory_xact_lock(hashtextextended(encode(p_email_digest, 'hex'), 1));
  IF (SELECT count(*) FROM iam.contact_recovery WHERE created_at > now() - interval '10 minutes') >= 2000
     OR EXISTS (SELECT 1 FROM iam.contact_recovery WHERE email_digest = p_email_digest AND created_at > now() - interval '15 minutes')
     OR (SELECT count(*) FROM iam.contact_recovery WHERE account = p_account AND completed_at > now() - interval '24 hours') >= 3 THEN
    RETURN false;
  END IF;
  -- One open attempt per account: a newer link replaces the older one.
  UPDATE iam.contact_recovery SET expires_at = least(expires_at, now()), subject = NULL, phone = NULL
   WHERE account = p_account AND completed_at IS NULL AND expires_at > now();
  INSERT INTO iam.contact_recovery (id, email_digest, account, subject, phone, lang, link_digest, expires_at)
  VALUES (p_id, p_email_digest, p_account, CASE WHEN p_phone IS NULL THEN NULL ELSE p_subject END, p_phone, p_lang, p_link_digest,
          now() + make_interval(mins => p_minutes));
  RETURN true;
END $$;

-- The link was followed: a new SMS code (at most 3 per attempt, 10 minutes each; earlier codes stop working).
-- Returns the number to send it to; raises P0002 when there is no such open attempt with that link.
CREATE FUNCTION iam.contact_recovery_code(p_id uuid, p_link_digest bytea, p_code_digest bytea, OUT phone text, OUT lang text, OUT code_expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, iam AS $$
BEGIN
  IF length(p_link_digest) <> 32 OR length(p_code_digest) <> 32 THEN
    RAISE EXCEPTION 'invalid contact recovery' USING ERRCODE = '22023';
  END IF;
  UPDATE iam.contact_recovery r SET code_digest = p_code_digest, codes_sent = r.codes_sent + 1, code_expires_at = least(r.expires_at + interval '10 minutes', now() + interval '10 minutes')
   WHERE r.id = p_id AND r.link_digest = p_link_digest AND r.completed_at IS NULL AND r.expires_at > now() AND r.codes_sent < 3
     AND r.attempts < 5 AND r.subject IS NOT NULL AND r.phone IS NOT NULL
  RETURNING r.phone, r.lang, r.code_expires_at INTO phone, lang, code_expires_at;
  IF NOT FOUND THEN RAISE EXCEPTION 'no such open recovery attempt' USING ERRCODE = 'P0002'; END IF;
END $$;

-- outcome: recovered (with the subject to reset) | wrong-code (attempts_left > 0) | not-found (no such open attempt with
-- that link and a current code, or out of tries; not distinguished). Both the link and the code are needed.
CREATE FUNCTION iam.complete_contact_recovery(p_id uuid, p_link_digest bytea, p_code_digest bytea,
  OUT outcome text, OUT subject text, OUT attempts_left integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, iam AS $$
DECLARE
  r iam.contact_recovery%ROWTYPE;
BEGIN
  IF length(p_link_digest) <> 32 OR length(p_code_digest) <> 32 THEN
    RAISE EXCEPTION 'invalid contact recovery' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO r FROM iam.contact_recovery x
   WHERE x.id = p_id AND x.link_digest = p_link_digest AND x.completed_at IS NULL AND x.code_digest IS NOT NULL
     AND x.code_expires_at > now() AND x.attempts < 5 AND x.subject IS NOT NULL
   FOR UPDATE;
  IF NOT FOUND THEN outcome := 'not-found'; attempts_left := 0; RETURN; END IF;
  IF r.code_digest <> p_code_digest THEN
    UPDATE iam.contact_recovery x SET attempts = x.attempts + 1 WHERE x.id = p_id;
    attempts_left := 4 - r.attempts;
    outcome := CASE WHEN attempts_left > 0 THEN 'wrong-code' ELSE 'not-found' END;
    IF attempts_left <= 0 THEN
      UPDATE iam.contact_recovery x SET subject = NULL, phone = NULL WHERE x.id = p_id;
      attempts_left := 0;
    END IF;
    RETURN;
  END IF;
  UPDATE iam.contact_recovery x SET completed_at = now(), subject = NULL, phone = NULL, code_digest = NULL WHERE x.id = p_id;
  outcome := 'recovered'; subject := r.subject; attempts_left := 0;
END $$;

REVOKE ALL ON FUNCTION iam.start_contact_change(uuid, bytea, text, text, bytea, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION iam.confirm_contact_change(uuid, bytea, bytea) FROM PUBLIC;
REVOKE ALL ON FUNCTION iam.start_contact_recovery(uuid, bytea, bytea, text, text, text, bytea, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION iam.contact_recovery_code(uuid, bytea, bytea) FROM PUBLIC;
REVOKE ALL ON FUNCTION iam.complete_contact_recovery(uuid, bytea, bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION iam.start_contact_change(uuid, bytea, text, text, bytea, integer) TO civora_core_app;
GRANT EXECUTE ON FUNCTION iam.confirm_contact_change(uuid, bytea, bytea) TO civora_core_app;
GRANT EXECUTE ON FUNCTION iam.start_contact_recovery(uuid, bytea, bytea, text, text, text, bytea, integer) TO civora_core_app;
GRANT EXECUTE ON FUNCTION iam.contact_recovery_code(uuid, bytea, bytea) TO civora_core_app;
GRANT EXECUTE ON FUNCTION iam.complete_contact_recovery(uuid, bytea, bytea) TO civora_core_app;

-- Down Migration
DROP FUNCTION iam.complete_contact_recovery(uuid, bytea, bytea);
DROP FUNCTION iam.contact_recovery_code(uuid, bytea, bytea);
DROP FUNCTION iam.start_contact_recovery(uuid, bytea, bytea, text, text, text, bytea, integer);
DROP TABLE iam.contact_recovery;
DROP FUNCTION iam.confirm_contact_change(uuid, bytea, bytea);
DROP FUNCTION iam.start_contact_change(uuid, bytea, text, text, bytea, integer);
DROP TABLE iam.contact_change;
