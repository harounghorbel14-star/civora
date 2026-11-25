-- Up Migration
-- Phase 3 week 6 (R-P3-15; doc phase-3/11 §5): quotas per person and per institution on top of the per-address edge
-- limits. A person proposes at most 30 mandates in 24 hours; an institution sends at most 200 staff invitations (each
-- one an e-mail) in 24 hours. Over the quota: SQLSTATE 53400, answered 429 by the core.

CREATE FUNCTION iam.mandate_quota() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, iam AS $$
BEGIN
  IF (SELECT count(*) FROM iam.mandate WHERE principal_id = NEW.principal_id AND created_at > now() - interval '24 hours') >= 30 THEN
    RAISE EXCEPTION 'at most 30 mandates a day per person' USING ERRCODE = '53400';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER mandate_quota BEFORE INSERT ON iam.mandate FOR EACH ROW EXECUTE FUNCTION iam.mandate_quota();

CREATE FUNCTION iam.invitation_quota() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, iam AS $$
BEGIN
  IF (SELECT count(*) FROM iam.staff_invitation WHERE tenant_id = NEW.tenant_id AND created_at > now() - interval '24 hours') >= 200 THEN
    RAISE EXCEPTION 'at most 200 staff invitations a day per institution' USING ERRCODE = '53400';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER invitation_quota BEFORE INSERT ON iam.staff_invitation FOR EACH ROW EXECUTE FUNCTION iam.invitation_quota();

REVOKE ALL ON FUNCTION iam.mandate_quota(), iam.invitation_quota() FROM PUBLIC;

-- Down Migration
DROP TRIGGER invitation_quota ON iam.staff_invitation;
DROP TRIGGER mandate_quota ON iam.mandate;
DROP FUNCTION iam.invitation_quota();
DROP FUNCTION iam.mandate_quota();
