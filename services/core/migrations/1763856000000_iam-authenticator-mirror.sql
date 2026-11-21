-- Up Migration
-- Authenticator mirror (P3-DB3): metadata of the person's Keycloak credentials (kind, label, Keycloak id, dates),
-- refreshed whenever the person lists or changes their authenticators. Secrets never leave Keycloak. The application
-- role cannot write the table directly: it calls this function, which only touches the current person's account.

CREATE FUNCTION iam.sync_authenticators(p_realm text, p_items jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, iam AS $$
DECLARE
  v_account uuid;
  v_count integer;
BEGIN
  IF iam.current_person() IS NULL THEN RAISE EXCEPTION 'no authenticated person' USING ERRCODE = '42501'; END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'items must be an array of at most 50' USING ERRCODE = '22023';
  END IF;
  SELECT id INTO v_account FROM iam.account WHERE person_id = iam.current_person() AND realm = p_realm;
  IF v_account IS NULL THEN RAISE EXCEPTION 'no account in realm %', p_realm USING ERRCODE = '42501'; END IF;
  DELETE FROM iam.authenticator a WHERE a.account_id = v_account
    AND a.keycloak_credential_id NOT IN (SELECT x->>'id' FROM jsonb_array_elements(p_items) x);
  INSERT INTO iam.authenticator (account_id, kind, label, keycloak_credential_id, created_at)
    SELECT v_account, x->>'kind', left(x->>'label', 64), x->>'id', coalesce((x->>'createdAt')::timestamptz, now())
      FROM jsonb_array_elements(p_items) x
  ON CONFLICT (keycloak_credential_id) DO UPDATE SET label = excluded.label
    WHERE iam.authenticator.account_id = v_account;          -- never touches another account's row
  SELECT count(*) INTO v_count FROM iam.authenticator WHERE account_id = v_account;
  RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION iam.sync_authenticators(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION iam.sync_authenticators(text, jsonb) TO civora_core_app;

-- Down Migration
DROP FUNCTION iam.sync_authenticators(text, jsonb);
