-- Up Migration
-- Phase 4 week 4: OpenID4VP 1.0 presentation requests and verification (P4-D3, P4-API4, P4-API5, P4-F3, P4-F4,
-- P4-SEC2, P4-SEC4; doc phase-4/05). A request is created by a member of the institution that registered the verifier;
-- the wallet fetches its signed request object, answers once by direct_post; the verified claims are kept until the
-- verifier's page reads them once, and at most 10 minutes (T1, then erased). The log keeps claim names only (DB5).

CREATE TABLE wallet.presentation_request (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verifier_id   uuid NOT NULL REFERENCES wallet.verifier(id),
  requested_by  uuid NOT NULL,
  nonce         text NOT NULL UNIQUE CHECK (nonce ~ '^[A-Za-z0-9_-]{43}$'),
  state         text NOT NULL UNIQUE CHECK (state ~ '^[A-Za-z0-9_-]{43}$'),
  vct           text NOT NULL,
  claims        text[] NOT NULL CHECK (cardinality(claims) BETWEEN 1 AND 40),
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  fetched_at    timestamptz,
  answered_at   timestamptz,
  result        text CHECK (result IN ('accepted', 'rejected')),
  reason        text CHECK (reason ~ '^[a-z][a-z-]{1,40}$'),
  disclosed     jsonb,
  read_at       timestamptz,
  CHECK (expires_at > created_at AND expires_at <= created_at + interval '10 minutes'),
  CHECK ((answered_at IS NULL) = (result IS NULL)),
  CHECK (disclosed IS NULL OR result = 'accepted')
);
COMMENT ON TABLE wallet.presentation_request IS 'P4-API4. OpenID4VP requests: nonce and state single use; the verified claims (T1) kept until read once or 10 minutes.';
CREATE INDEX ON wallet.presentation_request (expires_at);

-- The institution's staff create requests for their own verifier, for types and claims it is registered for (Q4-3).
CREATE FUNCTION wallet.create_presentation_request(p_client_id text, p_tenant uuid, p_requested_by uuid, p_nonce text, p_state text,
                                                   p_vct text, p_claims text[], p_ttl_seconds integer,
                                                   OUT request_id uuid, OUT expires_at timestamptz)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, wallet AS $$
DECLARE v wallet.verifier%ROWTYPE; t wallet.credential_type%ROWTYPE;
BEGIN
  SELECT * INTO v FROM wallet.verifier vr WHERE vr.client_id = p_client_id;
  IF NOT FOUND OR v.status <> 'active' THEN RAISE EXCEPTION 'unknown verifier' USING ERRCODE = '42704'; END IF;
  IF v.tenant_id IS DISTINCT FROM p_tenant OR p_tenant IS NULL THEN RAISE EXCEPTION 'not this institution''s verifier' USING ERRCODE = '42501'; END IF;
  IF NOT p_vct = ANY (v.allowed_vct) THEN RAISE EXCEPTION 'type not allowed for this verifier' USING ERRCODE = '42501'; END IF;
  IF NOT p_claims <@ v.allowed_claims THEN RAISE EXCEPTION 'claims not allowed for this verifier' USING ERRCODE = '42501'; END IF;
  SELECT * INTO t FROM wallet.credential_type ct WHERE ct.vct = p_vct;
  IF NOT FOUND OR NOT p_claims <@ t.claims THEN RAISE EXCEPTION 'claims not in this type' USING ERRCODE = '22023'; END IF;
  DELETE FROM wallet.presentation_request pr WHERE pr.expires_at < now() - interval '1 hour';
  UPDATE wallet.presentation_request pr SET disclosed = NULL WHERE pr.disclosed IS NOT NULL AND pr.answered_at < now() - interval '10 minutes';
  INSERT INTO wallet.presentation_request (verifier_id, requested_by, nonce, state, vct, claims, expires_at)
  VALUES (v.id, p_requested_by, p_nonce, p_state, p_vct, p_claims, now() + make_interval(secs => least(greatest(p_ttl_seconds, 60), 600)))
  RETURNING id, presentation_request.expires_at INTO request_id, expires_at;
END $$;

-- For the signed request object: the request while it can still be answered.
CREATE FUNCTION wallet.open_presentation_request(p_id uuid,
                                                 OUT client_id text, OUT nonce text, OUT state text, OUT vct text, OUT claims text[],
                                                 OUT expires_at timestamptz, OUT request_kid text, OUT hsm_token_label text, OUT hsm_key_id text, OUT request_jwk jsonb)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, wallet AS $$
BEGIN
  UPDATE wallet.presentation_request pr SET fetched_at = coalesce(pr.fetched_at, now())
   WHERE pr.id = p_id AND pr.answered_at IS NULL AND pr.expires_at > now();
  IF NOT FOUND THEN RETURN; END IF;
  SELECT v.client_id, pr.nonce, pr.state, pr.vct, pr.claims, pr.expires_at, v.request_kid, v.hsm_token_label, v.hsm_key_id, v.request_jwk
    INTO client_id, nonce, state, vct, claims, expires_at, request_kid, hsm_token_label, hsm_key_id, request_jwk
    FROM wallet.presentation_request pr JOIN wallet.verifier v ON v.id = pr.verifier_id WHERE pr.id = p_id;
END $$;

-- The direct_post response: the request by its state, once, before expiry (outcome 'unknown' otherwise).
CREATE FUNCTION wallet.pending_by_state(p_state text,
                                        OUT request_id uuid, OUT client_id text, OUT nonce text, OUT vct text, OUT claims text[], OUT verifier_id uuid)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, wallet AS $$
  SELECT pr.id, v.client_id, pr.nonce, pr.vct, pr.claims, v.id
    FROM wallet.presentation_request pr JOIN wallet.verifier v ON v.id = pr.verifier_id
   WHERE pr.state = p_state AND pr.answered_at IS NULL AND pr.expires_at > now()
$$;

-- P4-API5: a pending request of this staff member, answered with a presentation their own device scanned.
CREATE FUNCTION wallet.pending_for_staff(p_id uuid, p_requested_by uuid,
                                         OUT request_id uuid, OUT client_id text, OUT nonce text, OUT vct text, OUT claims text[], OUT verifier_id uuid)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, wallet AS $$
  SELECT pr.id, v.client_id, pr.nonce, pr.vct, pr.claims, v.id
    FROM wallet.presentation_request pr JOIN wallet.verifier v ON v.id = pr.verifier_id
   WHERE pr.id = p_id AND pr.requested_by = p_requested_by AND pr.answered_at IS NULL AND pr.expires_at > now()
$$;

-- Records the outcome once (false if already answered or expired) and logs it with claim names only.
CREATE FUNCTION wallet.record_presentation(p_request uuid, p_result text, p_reason text, p_types text[], p_claim_names text[], p_disclosed jsonb) RETURNS boolean
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, wallet AS $$
DECLARE v uuid;
BEGIN
  UPDATE wallet.presentation_request pr SET answered_at = now(), result = p_result, reason = p_reason,
         disclosed = CASE WHEN p_result = 'accepted' THEN p_disclosed END
   WHERE pr.id = p_request AND pr.answered_at IS NULL AND pr.expires_at > now()
  RETURNING pr.verifier_id INTO v;
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO wallet.presentation_log (verifier_id, request_id, result, reason, credential_types, disclosed_claims)
  VALUES (v, p_request, p_result, p_reason, coalesce(p_types, '{}'), coalesce(p_claim_names, '{}'));
  RETURN true;
END $$;

-- The verifier's page reads the outcome; the claims are handed over once and then erased.
CREATE FUNCTION wallet.read_presentation(p_request uuid, p_requested_by uuid,
                                         OUT status text, OUT reason text, OUT disclosed jsonb)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, wallet AS $$
DECLARE pr wallet.presentation_request%ROWTYPE;
BEGIN
  SELECT * INTO pr FROM wallet.presentation_request r WHERE r.id = p_request AND r.requested_by = p_requested_by FOR UPDATE;
  IF NOT FOUND THEN status := 'unknown'; RETURN; END IF;
  IF pr.answered_at IS NULL THEN status := CASE WHEN pr.expires_at <= now() THEN 'expired' ELSE 'pending' END; RETURN; END IF;
  status := pr.result;
  reason := pr.reason;
  IF pr.read_at IS NULL AND pr.answered_at > now() - interval '10 minutes' THEN disclosed := pr.disclosed; END IF;
  UPDATE wallet.presentation_request r SET disclosed = NULL, read_at = coalesce(r.read_at, now()) WHERE r.id = pr.id;
END $$;

-- The log of the institution's verifiers (DB5), for its administrators.
CREATE FUNCTION wallet.presentation_log_of(p_tenant uuid, p_limit integer)
  RETURNS TABLE (client_id text, request_id uuid, result text, reason text, credential_types text[], disclosed_claims text[], at timestamptz)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, wallet AS $$
  SELECT v.client_id, l.request_id, l.result, l.reason, l.credential_types, l.disclosed_claims, l.at
    FROM wallet.presentation_log l JOIN wallet.verifier v ON v.id = l.verifier_id
   WHERE v.tenant_id = p_tenant ORDER BY l.at DESC LIMIT least(greatest(p_limit, 1), 500)
$$;

REVOKE ALL ON FUNCTION wallet.create_presentation_request(text, uuid, uuid, text, text, text, text[], integer), wallet.open_presentation_request(uuid),
  wallet.pending_by_state(text), wallet.pending_for_staff(uuid, uuid), wallet.record_presentation(uuid, text, text, text[], text[], jsonb), wallet.read_presentation(uuid, uuid),
  wallet.presentation_log_of(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION wallet.create_presentation_request(text, uuid, uuid, text, text, text, text[], integer), wallet.open_presentation_request(uuid),
  wallet.pending_by_state(text), wallet.pending_for_staff(uuid, uuid), wallet.record_presentation(uuid, text, text, text[], text[], jsonb), wallet.read_presentation(uuid, uuid),
  wallet.presentation_log_of(uuid, integer) TO civora_core_app;

-- Down Migration
DROP FUNCTION wallet.presentation_log_of(uuid, integer);
DROP FUNCTION wallet.read_presentation(uuid, uuid);
DROP FUNCTION wallet.record_presentation(uuid, text, text, text[], text[], jsonb);
DROP FUNCTION wallet.pending_for_staff(uuid, uuid);
DROP FUNCTION wallet.pending_by_state(text);
DROP FUNCTION wallet.open_presentation_request(uuid);
DROP FUNCTION wallet.create_presentation_request(text, uuid, uuid, text, text, text, text[], integer);
DROP TABLE wallet.presentation_request;
