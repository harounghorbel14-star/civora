-- Up Migration
-- Phase 4 (P4-F5; doc phase-4/07): revocation and suspension asked for over HTTP, by the holder (for instance after
-- losing the phone) and by the issuer's officers. The status still changes only through wallet.set_credential_status
-- (status list bit, history); these functions decide who may call it for which reason.

-- The holder revokes a credential issued to them: the person comes from the session (row-level security setting),
-- never from the caller; another person's credential is "unknown". Revocation is final.
CREATE FUNCTION wallet.holder_revoke(p_issued uuid, p_reason text) RETURNS bigint
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, wallet AS $$
DECLARE person uuid := wallet.current_person();
BEGIN
  IF person IS NULL THEN RAISE EXCEPTION 'no person in this session' USING ERRCODE = '42501'; END IF;
  IF p_reason NOT IN ('holder-request', 'lost-device') THEN
    RAISE EXCEPTION 'a holder revokes for holder-request or lost-device' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT FROM wallet.issued_credential ic WHERE ic.id = p_issued AND ic.subject_person_id = person) THEN
    RAISE EXCEPTION 'unknown credential' USING ERRCODE = '23503';
  END IF;
  RETURN wallet.set_credential_status(p_issued, 'revoked', p_reason, 'holder:' || person::text);
END $$;

-- What an issuer's officer sees of one issued credential: type, issuer, status, dates, history. No claim values (the
-- cell keeps none) and not the subject.
CREATE FUNCTION wallet.issued_credential_view(p_issued uuid)
  RETURNS TABLE (id uuid, vct text, issuer text, status text, status_reason text, issued_at timestamptz, expires_at timestamptz,
                 status_changed_at timestamptz, history jsonb)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, wallet AS $$
  SELECT ic.id, ct.vct, i.slug, ic.status, ic.status_reason, ic.issued_at, ic.expires_at, ic.status_changed_at,
         coalesce((SELECT jsonb_agg(jsonb_build_object('action', e.action, 'reason', e.reason, 'by', split_part(e.actor, ':', 1), 'at', e.at) ORDER BY e.at)
                     FROM wallet.issued_credential_event e WHERE e.issued_credential_id = ic.id), '[]'::jsonb)
    FROM wallet.issued_credential ic
    JOIN wallet.credential_type ct ON ct.id = ic.credential_type_id
    JOIN wallet.issuer i ON i.id = ic.issuer_id
   WHERE ic.id = p_issued
$$;

-- An officer's decision: suspend while a case is reviewed, reinstate after the review, or revoke. The reasons each
-- action allows are fixed here; the officer's person id is the actor (accountability).
CREATE FUNCTION wallet.officer_set_status(p_issued uuid, p_status text, p_reason text, p_officer uuid) RETURNS bigint
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, wallet AS $$
BEGIN
  IF p_officer IS NULL THEN RAISE EXCEPTION 'the officer is required' USING ERRCODE = '42501'; END IF;
  IF NOT ((p_status = 'suspended' AND p_reason IN ('under-review', 'lost-device', 'data-changed'))
       OR (p_status = 'valid' AND p_reason = 'review-cleared')
       OR (p_status = 'revoked' AND p_reason IN ('holder-request', 'lost-device', 'data-changed', 'issued-in-error'))) THEN
    RAISE EXCEPTION 'this reason does not fit this action' USING ERRCODE = '22023';
  END IF;
  RETURN wallet.set_credential_status(p_issued, p_status, p_reason, 'staff:' || p_officer::text);
END $$;

REVOKE ALL ON FUNCTION wallet.holder_revoke(uuid, text), wallet.issued_credential_view(uuid), wallet.officer_set_status(uuid, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION wallet.holder_revoke(uuid, text), wallet.issued_credential_view(uuid), wallet.officer_set_status(uuid, text, text, uuid) TO civora_core_app;

-- Down Migration
DROP FUNCTION wallet.officer_set_status(uuid, text, text, uuid);
DROP FUNCTION wallet.issued_credential_view(uuid);
DROP FUNCTION wallet.holder_revoke(uuid, text);
