-- Up Migration
-- Phase 4 week 2: OpenID4VCI 1.0 issuance with a pre-authorised code (P4-API1, P4-API2, P4-F1, P4-SEC1, P4-SEC2).
-- Only digests of codes, tokens and nonces are stored. The transaction code (6 digits) is stored as a digest salted
-- with the pre-authorised code itself, which the cell does not keep: a copy of the database cannot be used to find it.
-- The application role reaches these tables only through the functions below. Doc phase-4/03.

CREATE TABLE wallet.credential_offer (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_type_id uuid NOT NULL REFERENCES wallet.credential_type(id),
  subject_person_id  uuid NOT NULL,
  code_digest        bytea NOT NULL UNIQUE CHECK (length(code_digest) = 32),
  tx_code_digest     bytea NOT NULL CHECK (length(tx_code_digest) = 32),
  tx_code_failures   smallint NOT NULL DEFAULT 0 CHECK (tx_code_failures BETWEEN 0 AND 5),
  created_at         timestamptz NOT NULL DEFAULT now(),
  expires_at         timestamptz NOT NULL,
  redeemed_at        timestamptz,
  CHECK (expires_at > created_at AND expires_at <= created_at + interval '30 minutes')
);
COMMENT ON TABLE wallet.credential_offer IS 'P4-API1, P4-F1. Credential offers (pre-authorised code, single use, at most 30 minutes, 5 wrong transaction codes).';
CREATE INDEX ON wallet.credential_offer (subject_person_id, expires_at);

CREATE TABLE wallet.access_token (
  digest     bytea PRIMARY KEY CHECK (length(digest) = 32),
  offer_id   uuid NOT NULL UNIQUE REFERENCES wallet.credential_offer(id),
  dpop_jkt   text NOT NULL CHECK (dpop_jkt ~ '^[A-Za-z0-9_-]{43}$'),
  expires_at timestamptz NOT NULL,
  used_at    timestamptz
);
COMMENT ON TABLE wallet.access_token IS 'P4-API2. Access tokens of the token endpoint: bound to the wallet''s DPoP key (RFC 9449), one credential each.';

CREATE TABLE wallet.nonce (
  digest     bytea PRIMARY KEY CHECK (length(digest) = 32),
  purpose    text NOT NULL CHECK (purpose IN ('c_nonce', 'vp')),
  expires_at timestamptz NOT NULL,
  used_at    timestamptz
);
COMMENT ON TABLE wallet.nonce IS 'P4-SEC2. Nonces: c_nonce for key proofs (OpenID4VCI nonce endpoint), nonces of presentation requests; single use.';

CREATE TABLE wallet.proof_jti (
  digest     bytea PRIMARY KEY CHECK (length(digest) = 32),
  expires_at timestamptz NOT NULL
);
COMMENT ON TABLE wallet.proof_jti IS 'P4-SEC2. Identifiers of DPoP proofs seen by the wallet endpoints (replay).';

CREATE FUNCTION wallet.create_offer(p_type uuid, p_subject uuid, p_code_digest bytea, p_tx_digest bytea, p_ttl_seconds integer,
                                    OUT offer_id uuid, OUT expires_at timestamptz)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, wallet AS $$
BEGIN
  IF NOT EXISTS (SELECT FROM wallet.credential_type t JOIN wallet.issuer i ON i.id = t.issuer_id WHERE t.id = p_type AND i.status = 'active') THEN
    RAISE EXCEPTION 'no active issuer for this type' USING ERRCODE = '55000';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('wallet.offer:' || p_subject::text, 0));
  IF (SELECT count(*) FROM wallet.credential_offer o WHERE o.subject_person_id = p_subject AND o.redeemed_at IS NULL AND o.expires_at > now()) >= 5 THEN
    RAISE EXCEPTION 'too many open offers' USING ERRCODE = '54000';
  END IF;
  INSERT INTO wallet.credential_offer (credential_type_id, subject_person_id, code_digest, tx_code_digest, expires_at)
  VALUES (p_type, p_subject, p_code_digest, p_tx_digest, now() + make_interval(secs => least(greatest(p_ttl_seconds, 60), 1800)))
  RETURNING id, credential_offer.expires_at INTO offer_id, expires_at;
END $$;

-- Token endpoint: redeems an offer once. Outcomes: ok, unknown (no such code, expired or already used), wrong-tx-code,
-- locked (5 wrong transaction codes: the offer is dead). A wrong code is counted even though the request fails.
CREATE FUNCTION wallet.redeem_offer(p_code_digest bytea, p_tx_digest bytea, p_token_digest bytea, p_jkt text, p_token_ttl integer,
                                    OUT outcome text, OUT token_expires_at timestamptz)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, wallet AS $$
DECLARE o wallet.credential_offer%ROWTYPE;
BEGIN
  SELECT * INTO o FROM wallet.credential_offer co WHERE co.code_digest = p_code_digest FOR UPDATE;
  IF NOT FOUND OR o.redeemed_at IS NOT NULL OR o.expires_at <= now() THEN outcome := 'unknown'; RETURN; END IF;
  IF o.tx_code_failures >= 5 THEN outcome := 'locked'; RETURN; END IF;
  IF o.tx_code_digest <> p_tx_digest THEN
    UPDATE wallet.credential_offer co SET tx_code_failures = co.tx_code_failures + 1 WHERE co.id = o.id;
    outcome := CASE WHEN o.tx_code_failures + 1 >= 5 THEN 'locked' ELSE 'wrong-tx-code' END;
    RETURN;
  END IF;
  UPDATE wallet.credential_offer co SET redeemed_at = now() WHERE co.id = o.id;
  INSERT INTO wallet.access_token (digest, offer_id, dpop_jkt, expires_at)
  VALUES (p_token_digest, o.id, p_jkt, now() + make_interval(secs => least(greatest(p_token_ttl, 30), 600)))
  RETURNING access_token.expires_at INTO token_expires_at;
  outcome := 'ok';
END $$;

-- What an access token may obtain (read only; the credential endpoint checks it before doing any work).
CREATE FUNCTION wallet.token_grant(p_token_digest bytea,
                                   OUT dpop_jkt text, OUT credential_type_id uuid, OUT issuer_id uuid, OUT subject_person_id uuid, OUT usable boolean)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, wallet AS $$
  SELECT t.dpop_jkt, o.credential_type_id, ct.issuer_id, o.subject_person_id, (t.used_at IS NULL AND t.expires_at > now())
    FROM wallet.access_token t JOIN wallet.credential_offer o ON o.id = t.offer_id JOIN wallet.credential_type ct ON ct.id = o.credential_type_id
   WHERE t.digest = p_token_digest
$$;

-- Credential endpoint, after every check passed: uses the token once and records the issuance (random status index).
CREATE FUNCTION wallet.issue_with_token(p_token_digest bytea, p_holder_jkt text, p_expires_at timestamptz,
                                        OUT issued_credential_id uuid, OUT status_list_id bigint, OUT status_idx integer)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, wallet AS $$
DECLARE t wallet.access_token%ROWTYPE; o wallet.credential_offer%ROWTYPE; r record;
BEGIN
  SELECT * INTO t FROM wallet.access_token tk WHERE tk.digest = p_token_digest FOR UPDATE;
  IF NOT FOUND OR t.used_at IS NOT NULL OR t.expires_at <= now() THEN
    RAISE EXCEPTION 'access token not usable' USING ERRCODE = '28000';
  END IF;
  SELECT * INTO o FROM wallet.credential_offer co WHERE co.id = t.offer_id;
  UPDATE wallet.access_token tk SET used_at = now() WHERE tk.digest = t.digest;
  SELECT * INTO r FROM wallet.record_issuance(o.credential_type_id, o.subject_person_id, p_holder_jkt, p_expires_at, 'issuer-system:oid4vci');
  issued_credential_id := r.issued_credential_id;
  status_list_id := r.status_list_id;
  status_idx := r.status_idx;
END $$;

CREATE FUNCTION wallet.new_nonce(p_digest bytea, p_purpose text, p_ttl_seconds integer) RETURNS timestamptz
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, wallet AS $$
DECLARE e timestamptz := now() + make_interval(secs => least(greatest(p_ttl_seconds, 30), 600));
BEGIN
  DELETE FROM wallet.nonce n WHERE n.expires_at < now() - interval '1 hour';
  INSERT INTO wallet.nonce (digest, purpose, expires_at) VALUES (p_digest, p_purpose, e);
  RETURN e;
END $$;

CREATE FUNCTION wallet.use_nonce(p_digest bytea, p_purpose text) RETURNS boolean
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, wallet AS $$
BEGIN
  UPDATE wallet.nonce n SET used_at = now() WHERE n.digest = p_digest AND n.purpose = p_purpose AND n.used_at IS NULL AND n.expires_at > now();
  RETURN FOUND;
END $$;

CREATE FUNCTION wallet.claim_proof_jti(p_digest bytea, p_ttl_seconds integer) RETURNS boolean
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, wallet AS $$
BEGIN
  DELETE FROM wallet.proof_jti j WHERE j.expires_at < now();
  INSERT INTO wallet.proof_jti (digest, expires_at) VALUES (p_digest, now() + make_interval(secs => p_ttl_seconds)) ON CONFLICT DO NOTHING;
  RETURN FOUND;
END $$;

REVOKE ALL ON FUNCTION wallet.create_offer(uuid, uuid, bytea, bytea, integer), wallet.redeem_offer(bytea, bytea, bytea, text, integer),
  wallet.token_grant(bytea), wallet.issue_with_token(bytea, text, timestamptz), wallet.new_nonce(bytea, text, integer),
  wallet.use_nonce(bytea, text), wallet.claim_proof_jti(bytea, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION wallet.create_offer(uuid, uuid, bytea, bytea, integer), wallet.redeem_offer(bytea, bytea, bytea, text, integer),
  wallet.token_grant(bytea), wallet.issue_with_token(bytea, text, timestamptz), wallet.new_nonce(bytea, text, integer),
  wallet.use_nonce(bytea, text), wallet.claim_proof_jti(bytea, integer) TO civora_core_app;

-- Down Migration
DROP FUNCTION wallet.claim_proof_jti(bytea, integer);
DROP FUNCTION wallet.use_nonce(bytea, text);
DROP FUNCTION wallet.new_nonce(bytea, text, integer);
DROP FUNCTION wallet.issue_with_token(bytea, text, timestamptz);
DROP FUNCTION wallet.token_grant(bytea);
DROP FUNCTION wallet.redeem_offer(bytea, bytea, bytea, text, integer);
DROP FUNCTION wallet.create_offer(uuid, uuid, bytea, bytea, integer);
DROP TABLE wallet.proof_jti;
DROP TABLE wallet.nonce;
DROP TABLE wallet.access_token;
DROP TABLE wallet.credential_offer;
