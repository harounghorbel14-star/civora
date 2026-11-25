-- Up Migration
-- Phase 3 week 6 (P3-DB6; doc phase-3/12): the core mirrors each citizen's pairwise subject per relying-party sector,
-- computed as Keycloak computes it (verified against Keycloak tokens in the realms test). Only for the current person;
-- the person sees their own rows (policy pairwise_self).

CREATE FUNCTION iam.mirror_pairwise_id(p_sector text, p_pairwise text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, iam AS $$
BEGIN
  IF iam.current_person() IS NULL OR NOT EXISTS (SELECT 1 FROM iam.account WHERE person_id = iam.current_person() AND realm = 'citizens') THEN
    RAISE EXCEPTION 'citizens only' USING ERRCODE = '42501';
  END IF;
  INSERT INTO iam.pairwise_id (person_id, sector, pairwise_sub) VALUES (iam.current_person(), p_sector, p_pairwise)
    ON CONFLICT (person_id, sector) DO UPDATE SET pairwise_sub = excluded.pairwise_sub;
END $$;

REVOKE ALL ON FUNCTION iam.mirror_pairwise_id(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION iam.mirror_pairwise_id(text, text) TO civora_core_app;

-- Down Migration
DROP FUNCTION iam.mirror_pairwise_id(text, text);
