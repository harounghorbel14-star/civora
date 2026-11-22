-- Up Migration
-- "Acting on behalf of" (P3-F6): when an agent starts acting under a mandate, the event is recorded and visible to the
-- principal and the agent (P3-AC3). Only the agent of an active, unexpired mandate can do it.

ALTER TABLE iam.mandate_event DROP CONSTRAINT mandate_event_action_check;
ALTER TABLE iam.mandate_event ADD CONSTRAINT mandate_event_action_check CHECK (action IN ('created', 'accepted', 'revoked', 'renounced', 'acted'));

CREATE FUNCTION iam.act_under_mandate(p_id uuid) RETURNS TABLE (scopes text[], expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, iam AS $$
#variable_conflict use_column
DECLARE v_me uuid := iam.current_person();
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'no authenticated person' USING ERRCODE = '42501'; END IF;
  PERFORM 1 FROM iam.mandate m
   WHERE m.id = p_id AND m.agent_id = v_me AND m.status = 'active' AND m.valid_from <= now() AND m.expires_at > now();
  IF NOT FOUND THEN RETURN; END IF;
  INSERT INTO iam.mandate_event (mandate_id, actor_id, action) VALUES (p_id, v_me, 'acted');
  RETURN QUERY SELECT m.scopes, m.expires_at FROM iam.mandate m WHERE m.id = p_id;
END $$;

REVOKE ALL ON FUNCTION iam.act_under_mandate(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION iam.act_under_mandate(uuid) TO civora_core_app;

-- Down Migration
DROP FUNCTION iam.act_under_mandate(uuid);
DELETE FROM iam.mandate_event WHERE action = 'acted';
ALTER TABLE iam.mandate_event DROP CONSTRAINT mandate_event_action_check;
ALTER TABLE iam.mandate_event ADD CONSTRAINT mandate_event_action_check CHECK (action IN ('created', 'accepted', 'revoked', 'renounced'));
