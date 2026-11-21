-- Up Migration
-- Branch/team-scoped roles (P3-R3) and staff invitations (closing R-P3-3 for staff onboarding).
-- An institution (tenant) has branches; a branch has teams. A person holds a role in a unit: "member" or "supervisor";
-- a branch supervisor's role covers the teams of that branch. Every row belongs to one tenant, and a staff request
-- carries its tenant (app.tenant_id) and whether the caller is the tenant's administrator (app.tenant_admin), both
-- set by the core from the verified access token for the transaction only.

CREATE FUNCTION iam.current_tenant() RETURNS uuid
  LANGUAGE sql STABLE PARALLEL SAFE
  AS $$ SELECT nullif(current_setting('app.tenant_id', true), '')::uuid $$;
CREATE FUNCTION iam.current_is_tenant_admin() RETURNS boolean
  LANGUAGE sql STABLE PARALLEL SAFE
  AS $$ SELECT coalesce(current_setting('app.tenant_admin', true), '') = 'true' AND iam.current_tenant() IS NOT NULL $$;

CREATE TABLE iam.org_unit (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL,
  parent_id  uuid REFERENCES iam.org_unit(id) ON DELETE CASCADE,
  kind       text NOT NULL CHECK (kind IN ('branch', 'team')),
  name       text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'branch') = (parent_id IS NULL))     -- branches at the top, teams inside a branch
);
CREATE UNIQUE INDEX org_unit_name_per_parent ON iam.org_unit (tenant_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));
COMMENT ON TABLE iam.org_unit IS 'P3-R3. Branch or team of an institution (tenant).';

CREATE TABLE iam.membership (
  person_id   uuid NOT NULL REFERENCES iam.person(id) ON DELETE CASCADE,
  org_unit_id uuid NOT NULL REFERENCES iam.org_unit(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('member', 'supervisor')),
  granted_by  uuid REFERENCES iam.person(id),
  granted_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (person_id, org_unit_id)
);
COMMENT ON TABLE iam.membership IS 'P3-R3. Role of a person in a branch or team.';

CREATE TABLE iam.staff_invitation (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  subject     text NOT NULL UNIQUE CHECK (length(subject) BETWEEN 1 AND 255),   -- Keycloak user created for the invitee
  org_unit_id uuid NOT NULL REFERENCES iam.org_unit(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('member', 'supervisor')),
  invited_by  uuid NOT NULL REFERENCES iam.person(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  accepted_at timestamptz,
  CHECK (expires_at > created_at AND expires_at <= created_at + interval '7 days')
);
COMMENT ON TABLE iam.staff_invitation IS 'A tenant administrator invited this person into a unit; the membership is created at their first sign-in.';
CREATE INDEX ON iam.membership (org_unit_id);
CREATE INDEX ON iam.org_unit (tenant_id);

ALTER TABLE iam.org_unit ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.membership ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.staff_invitation ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_unit_tenant ON iam.org_unit FOR SELECT USING (tenant_id = iam.current_tenant());
CREATE POLICY membership_visible ON iam.membership FOR SELECT USING (
  person_id = iam.current_person()
  OR (iam.current_is_tenant_admin() AND org_unit_id IN (SELECT id FROM iam.org_unit WHERE tenant_id = iam.current_tenant())));
CREATE POLICY invitation_admin ON iam.staff_invitation FOR SELECT USING (iam.current_is_tenant_admin() AND tenant_id = iam.current_tenant());

-- The person's role in a unit, directly or through the branch that contains it ('supervisor' outranks 'member').
CREATE FUNCTION iam.unit_role(p_person uuid, p_unit uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, iam AS $$
  SELECT CASE WHEN bool_or(m.role = 'supervisor') THEN 'supervisor' WHEN count(m.*) > 0 THEN 'member' END
    FROM iam.org_unit u JOIN iam.membership m ON m.person_id = p_person AND m.org_unit_id IN (u.id, u.parent_id)
   WHERE u.id = p_unit AND u.tenant_id = iam.current_tenant()
$$;

CREATE FUNCTION iam.create_org_unit(p_kind text, p_name text, p_parent uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, iam AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT iam.current_is_tenant_admin() THEN RAISE EXCEPTION 'tenant administrator only' USING ERRCODE = '42501'; END IF;
  IF p_parent IS NOT NULL AND NOT EXISTS (SELECT 1 FROM iam.org_unit WHERE id = p_parent AND tenant_id = iam.current_tenant() AND kind = 'branch') THEN
    RAISE EXCEPTION 'parent must be a branch of this institution' USING ERRCODE = '22023';
  END IF;
  INSERT INTO iam.org_unit (tenant_id, parent_id, kind, name) VALUES (iam.current_tenant(), p_parent, p_kind, btrim(p_name)) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- Members of a unit: for the tenant administrator, or a supervisor of the unit (or of its branch).
CREATE FUNCTION iam.unit_members(p_unit uuid) RETURNS TABLE (person_id uuid, role text, granted_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, iam AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM iam.org_unit WHERE id = p_unit AND tenant_id = iam.current_tenant()) THEN
    RAISE EXCEPTION 'no such unit' USING ERRCODE = 'P0002';
  END IF;
  IF NOT iam.current_is_tenant_admin() AND coalesce(iam.unit_role(iam.current_person(), p_unit), '') <> 'supervisor' THEN
    RAISE EXCEPTION 'tenant administrator or supervisor only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT m.person_id, m.role, m.granted_at FROM iam.membership m WHERE m.org_unit_id = p_unit ORDER BY m.granted_at;
END $$;

CREATE FUNCTION iam.grant_membership(p_person uuid, p_unit uuid, p_role text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, iam AS $$
BEGIN
  IF NOT iam.current_is_tenant_admin() THEN RAISE EXCEPTION 'tenant administrator only' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM iam.org_unit WHERE id = p_unit AND tenant_id = iam.current_tenant()) THEN
    RAISE EXCEPTION 'no such unit' USING ERRCODE = 'P0002';
  END IF;
  -- Only staff of the same institution can be given a role in its units.
  IF NOT EXISTS (SELECT 1 FROM iam.account WHERE person_id = p_person AND realm = 'staff' AND tenant_id = iam.current_tenant()) THEN
    RAISE EXCEPTION 'not a staff member of this institution' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO iam.membership (person_id, org_unit_id, role, granted_by) VALUES (p_person, p_unit, p_role, iam.current_person())
    ON CONFLICT (person_id, org_unit_id) DO UPDATE SET role = excluded.role, granted_by = excluded.granted_by, granted_at = now();
END $$;

CREATE FUNCTION iam.revoke_membership(p_person uuid, p_unit uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, iam AS $$
BEGIN
  IF NOT iam.current_is_tenant_admin() THEN RAISE EXCEPTION 'tenant administrator only' USING ERRCODE = '42501'; END IF;
  DELETE FROM iam.membership m USING iam.org_unit u
   WHERE m.person_id = p_person AND m.org_unit_id = p_unit AND u.id = m.org_unit_id AND u.tenant_id = iam.current_tenant();
  RETURN FOUND;
END $$;

CREATE FUNCTION iam.record_staff_invitation(p_subject text, p_unit uuid, p_role text, p_expires_at timestamptz) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, iam AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT iam.current_is_tenant_admin() OR iam.current_person() IS NULL THEN RAISE EXCEPTION 'tenant administrator only' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM iam.org_unit WHERE id = p_unit AND tenant_id = iam.current_tenant()) THEN
    RAISE EXCEPTION 'no such unit' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO iam.staff_invitation (tenant_id, subject, org_unit_id, role, invited_by, expires_at)
    VALUES (iam.current_tenant(), p_subject, p_unit, p_role, iam.current_person(), p_expires_at) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- First sign-in of a staff account: pending, unexpired invitations of the same tenant become memberships.
CREATE OR REPLACE FUNCTION iam.ensure_person(p_realm text, p_subject text, p_tenant uuid, p_locale text) RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, iam AS $$
DECLARE v_person uuid;
BEGIN
  SELECT a.person_id INTO v_person FROM iam.account a WHERE a.realm = p_realm AND a.subject = p_subject;
  IF v_person IS NULL THEN
    INSERT INTO iam.person (preferred_locale) VALUES (coalesce(p_locale, 'ar-TN')) RETURNING id INTO v_person;
    INSERT INTO iam.account (person_id, realm, tenant_id, subject) VALUES (v_person, p_realm, p_tenant, p_subject);
  END IF;
  IF p_realm = 'staff' THEN
    INSERT INTO iam.membership (person_id, org_unit_id, role, granted_by)
      SELECT v_person, i.org_unit_id, i.role, i.invited_by FROM iam.staff_invitation i
       WHERE i.subject = p_subject AND i.tenant_id = p_tenant AND i.accepted_at IS NULL AND i.expires_at > now()
    ON CONFLICT (person_id, org_unit_id) DO NOTHING;
    UPDATE iam.staff_invitation SET accepted_at = now()
     WHERE subject = p_subject AND tenant_id = p_tenant AND accepted_at IS NULL AND expires_at > now();
  END IF;
  RETURN v_person;
END $$;

REVOKE ALL ON FUNCTION iam.current_tenant(), iam.current_is_tenant_admin(), iam.unit_role(uuid, uuid), iam.create_org_unit(text, text, uuid),
  iam.unit_members(uuid), iam.grant_membership(uuid, uuid, text), iam.revoke_membership(uuid, uuid), iam.record_staff_invitation(text, uuid, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION iam.current_tenant(), iam.current_is_tenant_admin(), iam.unit_role(uuid, uuid), iam.create_org_unit(text, text, uuid),
  iam.unit_members(uuid), iam.grant_membership(uuid, uuid, text), iam.revoke_membership(uuid, uuid), iam.record_staff_invitation(text, uuid, text, timestamptz) TO civora_core_app;
GRANT SELECT ON iam.org_unit, iam.membership, iam.staff_invitation TO civora_core_app;

-- Down Migration
CREATE OR REPLACE FUNCTION iam.ensure_person(p_realm text, p_subject text, p_tenant uuid, p_locale text) RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, iam AS $$
DECLARE v_person uuid;
BEGIN
  SELECT a.person_id INTO v_person FROM iam.account a WHERE a.realm = p_realm AND a.subject = p_subject;
  IF v_person IS NULL THEN
    INSERT INTO iam.person (preferred_locale) VALUES (coalesce(p_locale, 'ar-TN')) RETURNING id INTO v_person;
    INSERT INTO iam.account (person_id, realm, tenant_id, subject) VALUES (v_person, p_realm, p_tenant, p_subject);
  END IF;
  RETURN v_person;
END $$;
DROP FUNCTION iam.record_staff_invitation(text, uuid, text, timestamptz);
DROP FUNCTION iam.revoke_membership(uuid, uuid);
DROP FUNCTION iam.grant_membership(uuid, uuid, text);
DROP FUNCTION iam.unit_members(uuid);
DROP FUNCTION iam.create_org_unit(text, text, uuid);
DROP FUNCTION iam.unit_role(uuid, uuid);
DROP TABLE iam.staff_invitation;
DROP TABLE iam.membership;
DROP TABLE iam.org_unit;
DROP FUNCTION iam.current_is_tenant_admin();
DROP FUNCTION iam.current_tenant();
