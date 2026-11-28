-- Up Migration
-- Phase 5 (P5-F4; doc phase-5/04): editors read and decide the readers' error reports. Until now the reports could
-- only be written. The application role still cannot read the table: these functions are its only way in, and the
-- application checks the editor role and the cell operator's institution before calling them (P5-SEC1).
-- Also: a report must name a version that was published (published or superseded); any number was accepted.

ALTER TABLE catalogue.content_error_report
  ADD COLUMN note text CHECK (note IS NULL OR length(note) BETWEEN 3 AND 1000);
COMMENT ON COLUMN catalogue.content_error_report.note IS 'The editor''s note on the decision (for instance the version that corrects it). No reader data.';

CREATE OR REPLACE FUNCTION catalogue.report_error(p_code text, p_version integer, p_message text) RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, catalogue AS $$
DECLARE s uuid; r uuid;
BEGIN
  SELECT id INTO s FROM catalogue.service WHERE code = p_code AND published_version IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'no such published service' USING ERRCODE = '42704'; END IF;
  IF NOT EXISTS (SELECT FROM catalogue.service_version v WHERE v.service_id = s AND v.version = p_version AND v.state IN ('published', 'superseded')) THEN
    RAISE EXCEPTION 'no such published version' USING ERRCODE = '42704';
  END IF;
  IF (SELECT count(*) FROM catalogue.content_error_report e WHERE e.service_id = s AND e.status = 'open') >= 200 THEN
    RAISE EXCEPTION 'too many open reports for this service' USING ERRCODE = '54000';
  END IF;
  INSERT INTO catalogue.content_error_report (service_id, version, message) VALUES (s, p_version, p_message) RETURNING id INTO r;
  RETURN r;
END $$;

-- The reports, newest first, by status (open by default), at most 200 per call.
CREATE FUNCTION catalogue.list_error_reports(p_status text, p_limit integer)
  RETURNS TABLE (id uuid, code text, slug text, version integer, message text, status text, created_at timestamptz, handled_at timestamptz, note text)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, catalogue AS $$
  SELECT e.id, s.code, s.slug, e.version, e.message, e.status, e.created_at, e.handled_at, e.note
    FROM catalogue.content_error_report e JOIN catalogue.service s ON s.id = e.service_id
   WHERE e.status = coalesce(p_status, 'open')
   ORDER BY e.created_at DESC, e.id
   LIMIT least(greatest(coalesce(p_limit, 50), 1), 200)
$$;

-- A decision on an open report: accepted (the content will be corrected in a new version) or rejected. Once only.
CREATE FUNCTION catalogue.decide_error_report(p_id uuid, p_actor uuid, p_decision text, p_note text) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, catalogue AS $$
BEGIN
  IF p_decision NOT IN ('accepted', 'rejected') THEN RAISE EXCEPTION 'the decision is accepted or rejected' USING ERRCODE = '22023'; END IF;
  UPDATE catalogue.content_error_report e SET status = p_decision, handled_by = p_actor, handled_at = now(), note = p_note
   WHERE e.id = p_id AND e.status = 'open';
  IF NOT FOUND THEN
    IF EXISTS (SELECT FROM catalogue.content_error_report e WHERE e.id = p_id) THEN
      RAISE EXCEPTION 'this report has already been decided' USING ERRCODE = '55000';
    END IF;
    RAISE EXCEPTION 'no such report' USING ERRCODE = '42704';
  END IF;
END $$;

REVOKE ALL ON FUNCTION catalogue.list_error_reports(text, integer), catalogue.decide_error_report(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION catalogue.list_error_reports(text, integer), catalogue.decide_error_report(uuid, uuid, text, text) TO civora_core_app;

-- Down Migration
DROP FUNCTION catalogue.decide_error_report(uuid, uuid, text, text);
DROP FUNCTION catalogue.list_error_reports(text, integer);
CREATE OR REPLACE FUNCTION catalogue.report_error(p_code text, p_version integer, p_message text) RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, catalogue AS $$
DECLARE s uuid; r uuid;
BEGIN
  SELECT id INTO s FROM catalogue.service WHERE code = p_code AND published_version IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'no such published service' USING ERRCODE = '42704'; END IF;
  IF (SELECT count(*) FROM catalogue.content_error_report e WHERE e.service_id = s AND e.status = 'open') >= 200 THEN
    RAISE EXCEPTION 'too many open reports for this service' USING ERRCODE = '54000';
  END IF;
  INSERT INTO catalogue.content_error_report (service_id, version, message) VALUES (s, p_version, p_message) RETURNING id INTO r;
  RETURN r;
END $$;
ALTER TABLE catalogue.content_error_report DROP COLUMN note;
