-- Up Migration
-- Phase 5 (P5-DB1..DB6; doc phase-5/01): the Government Services Directory on the pg-public cluster (P5-A1, ADR-003).
-- Public reference data only (tier T3): no personal data. Editors and approvers are referred to by the person id the
-- identity-access module gives them (no foreign key across clusters).
-- Rules enforced here, not only in the application:
--   * every step, requirement and fee of a version cites at least one source (P5-AC1: 100 % citation coverage);
--   * a version is approved by someone other than its author (four-eyes, P5-D2), and only when it is complete;
--   * an approved version is immutable; it is published with the content digest and signature (P5-SEC2) it was
--     approved with; publishing a newer version supersedes the older one (change history, P5-F3);
--   * the application role reads only published content and writes only through the functions below.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'civora_core_app') THEN
    IF (SELECT rolsuper OR rolcreaterole FROM pg_roles WHERE rolname = current_user) THEN
      BEGIN
        CREATE ROLE civora_core_app NOLOGIN NOBYPASSRLS;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;
    ELSE
      RAISE EXCEPTION 'role civora_core_app is missing: create it with the database role before migrating';
    END IF;
  END IF;
END $$;

CREATE SCHEMA catalogue;
COMMENT ON SCHEMA catalogue IS 'catalogue module (Phase 5): services, versions, requirements, sources, offices, editorial reviews. Tier T3 (public). Owner: catalogue only (ADR-001).';

-- P5-DB4. A source: an official legal text (official journal reference) or an official government page.
CREATE TABLE catalogue.source_ref (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind          text NOT NULL CHECK (kind IN ('legal-text', 'official-page')),
  title         text NOT NULL CHECK (length(title) BETWEEN 3 AND 400),
  publisher     text NOT NULL CHECK (length(publisher) BETWEEN 2 AND 200),
  url           text NOT NULL CHECK (url ~ '^https://[^\s]+$' AND length(url) BETWEEN 12 AND 500),
  jort_reference text CHECK (jort_reference IS NULL OR length(jort_reference) BETWEEN 3 AND 200),
  language      text NOT NULL CHECK (language IN ('ar', 'fr', 'en')),
  accessed_on   date NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'legal-text') = (jort_reference IS NOT NULL)),
  UNIQUE (url)
);
COMMENT ON TABLE catalogue.source_ref IS 'P5-DB4. Sources cited by service content: legal texts (with their official journal reference) and official pages.';

-- P5-DB5. An office where a procedure is done, as listed by an official source.
CREATE TABLE catalogue.office (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code             text NOT NULL UNIQUE CHECK (code ~ '^[a-z0-9][a-z0-9-]{2,62}$'),
  name             jsonb NOT NULL CHECK (name ?& ARRAY['ar', 'fr']),
  institution      jsonb NOT NULL CHECK (institution ?& ARRAY['ar', 'fr']),
  governorate      text NOT NULL CHECK (length(governorate) BETWEEN 2 AND 60),
  address          jsonb NOT NULL CHECK (address ?& ARRAY['ar', 'fr']),
  latitude         numeric(8, 6) CHECK (latitude BETWEEN 30 AND 38),
  longitude        numeric(9, 6) CHECK (longitude BETWEEN 7 AND 12),
  hours            jsonb,
  source_ref_id    uuid NOT NULL REFERENCES catalogue.source_ref(id),
  last_verified_on date NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CHECK ((latitude IS NULL) = (longitude IS NULL))
);
COMMENT ON TABLE catalogue.office IS 'P5-DB5. Offices (office locator, P5-F2), each from an official source. Coordinates bounded to Tunisia.';

-- P5-DB1. A service (procedure). Its content lives in versions.
CREATE TABLE catalogue.service (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code               text NOT NULL UNIQUE CHECK (code ~ '^TN-[A-Z]{3}-[0-9]{3}$'),
  slug               text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{2,80}$'),
  category           text NOT NULL CHECK (category ~ '^[a-z][a-z-]{2,40}$'),
  published_version  integer,
  created_by         uuid NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE catalogue.service IS 'P5-DB1. A government procedure. code: TN-<area>-<nnn>; slug: the page address (also used by wallet renewal links).';

-- P5-DB2. A version of a service's content, from draft to published or superseded.
CREATE TABLE catalogue.service_version (
  service_id        uuid NOT NULL REFERENCES catalogue.service(id),
  version           integer NOT NULL CHECK (version >= 1),
  state             text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'in-review', 'approved', 'published', 'superseded', 'withdrawn')),
  title             jsonb NOT NULL CHECK (title ?& ARRAY['ar', 'fr']),
  summary           jsonb NOT NULL CHECK (summary ?& ARRAY['ar', 'fr']),
  institution       jsonb NOT NULL CHECK (institution ?& ARRAY['ar', 'fr']),
  online_url        text CHECK (online_url ~ '^https://'),
  processing_time   jsonb,
  translation_review text NOT NULL DEFAULT 'pending' CHECK (translation_review IN ('pending', 'reviewed')),
  change_note       text NOT NULL CHECK (length(change_note) BETWEEN 3 AND 1000),
  last_verified_on  date,
  author            uuid NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  submitted_at      timestamptz,
  approved_by       uuid,
  approved_at       timestamptz,
  published_at      timestamptz,
  content_digest    bytea CHECK (content_digest IS NULL OR length(content_digest) = 32),
  signature         text CHECK (signature IS NULL OR signature ~ '^[A-Za-z0-9_-]+\.\.[A-Za-z0-9_-]+$'),
  PRIMARY KEY (service_id, version),
  CHECK (approved_by IS NULL OR approved_by <> author),
  CHECK ((state IN ('approved', 'published', 'superseded')) = (approved_by IS NOT NULL AND content_digest IS NOT NULL AND signature IS NOT NULL AND last_verified_on IS NOT NULL))
);
COMMENT ON TABLE catalogue.service_version IS 'P5-DB2. Versions of a service: draft -> in-review -> approved (four-eyes, signed) -> published -> superseded. Change history (P5-F3).';

-- P5-DB3. The parts of a version: steps, documents, conditions, fees. Each cites at least one source.
CREATE TABLE catalogue.requirement (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id  uuid NOT NULL,
  version     integer NOT NULL,
  kind        text NOT NULL CHECK (kind IN ('step', 'document', 'condition', 'fee')),
  position    smallint NOT NULL CHECK (position BETWEEN 1 AND 99),
  text        jsonb NOT NULL CHECK (text ?& ARRAY['ar', 'fr']),
  amount_tnd  numeric(10, 3) CHECK (amount_tnd IS NULL OR amount_tnd >= 0),
  source_ids  uuid[] NOT NULL CHECK (cardinality(source_ids) BETWEEN 1 AND 10),
  FOREIGN KEY (service_id, version) REFERENCES catalogue.service_version(service_id, version) ON DELETE CASCADE,
  UNIQUE (service_id, version, kind, position),
  CHECK ((kind = 'fee') OR amount_tnd IS NULL)
);
COMMENT ON TABLE catalogue.requirement IS 'P5-DB3. Steps, documents, conditions and fees of a version, each with its sources (100 % citation coverage).';

CREATE TABLE catalogue.version_office (
  service_id uuid NOT NULL,
  version    integer NOT NULL,
  office_id  uuid NOT NULL REFERENCES catalogue.office(id),
  PRIMARY KEY (service_id, version, office_id),
  FOREIGN KEY (service_id, version) REFERENCES catalogue.service_version(service_id, version) ON DELETE CASCADE
);

-- P5-DB6. Editorial reviews: who decided what on which version.
CREATE TABLE catalogue.editorial_review (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  service_id  uuid NOT NULL,
  version     integer NOT NULL,
  reviewer    uuid NOT NULL,
  decision    text NOT NULL CHECK (decision IN ('submitted', 'approved', 'changes-requested', 'published', 'withdrawn')),
  comment     text CHECK (comment IS NULL OR length(comment) <= 2000),
  at          timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (service_id, version) REFERENCES catalogue.service_version(service_id, version)
);
COMMENT ON TABLE catalogue.editorial_review IS 'P5-DB6. Append-only editorial log (four-eyes approval, publication, withdrawal).';

-- P5-F4. "Report an error": what is wrong, on which version; nothing about who reported it.
CREATE TABLE catalogue.content_error_report (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id  uuid NOT NULL REFERENCES catalogue.service(id),
  version     integer NOT NULL,
  message     text NOT NULL CHECK (length(message) BETWEEN 5 AND 2000),
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'rejected')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  handled_by  uuid,
  handled_at  timestamptz
);
COMMENT ON TABLE catalogue.content_error_report IS 'P5-F4. Error reports from readers: no name, no contact, no address (ADR-018).';
CREATE INDEX ON catalogue.content_error_report (service_id, status);

-- Search (P5-A3): Arabic normalisation (alef forms, taa marbuta, alef maqsura, diacritics and tatweel), light
-- stemming of the definite article and the prefixes joined to it (ال، لل، وال، بال، كال، فال) at the start of a word,
-- and French accent folding, so that a query matches however it is typed. The same function builds the index and
-- reads the query.
CREATE FUNCTION catalogue.normalise(t text) RETURNS text
  LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
  SELECT regexp_replace(
           translate(
             regexp_replace(lower(t), '[ً-ْـ]', '', 'g'),
             'أإآٱةىàâäéèêëîïôöùûüç',
             'ااااهيaaaeeeeiioouuuc'),
           '(^|[^[:alnum:]])(وال|بال|كال|فال|لل|ال)([[:alnum:]]{2,})', '\1\3', 'g')
$$;

CREATE TABLE catalogue.search_document (
  service_id uuid PRIMARY KEY REFERENCES catalogue.service(id),
  document   tsvector NOT NULL
);
CREATE INDEX ON catalogue.search_document USING gin (document);

-- Functions: the only way the application changes content. p_actor is the person id from a verified staff token;
-- the application checks the editor and approver roles (RBAC, P5-SEC1) before calling them.

CREATE FUNCTION catalogue.add_source(p_kind text, p_title text, p_publisher text, p_url text, p_jort text, p_language text, p_accessed date) RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, catalogue AS $$
DECLARE r uuid;
BEGIN
  INSERT INTO catalogue.source_ref (kind, title, publisher, url, jort_reference, language, accessed_on)
  VALUES (p_kind, p_title, p_publisher, p_url, p_jort, p_language, p_accessed)
  ON CONFLICT (url) DO UPDATE SET accessed_on = greatest(source_ref.accessed_on, EXCLUDED.accessed_on)
  RETURNING id INTO r;
  RETURN r;
END $$;

CREATE FUNCTION catalogue.add_office(p_code text, p_name jsonb, p_institution jsonb, p_governorate text, p_address jsonb,
                                     p_lat numeric, p_lon numeric, p_hours jsonb, p_source uuid, p_verified date) RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, catalogue AS $$
DECLARE r uuid;
BEGIN
  INSERT INTO catalogue.office (code, name, institution, governorate, address, latitude, longitude, hours, source_ref_id, last_verified_on)
  VALUES (p_code, p_name, p_institution, p_governorate, p_address, p_lat, p_lon, p_hours, p_source, p_verified)
  RETURNING id INTO r;
  RETURN r;
END $$;

-- P5-API3 POST /v1/admin/services: a new service with its first draft.
CREATE FUNCTION catalogue.create_service(p_code text, p_slug text, p_category text, p_actor uuid, p_draft jsonb) RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, catalogue AS $$
DECLARE s uuid;
BEGIN
  INSERT INTO catalogue.service (code, slug, category, created_by) VALUES (p_code, p_slug, p_category, p_actor) RETURNING id INTO s;
  PERFORM catalogue.put_draft(s, 1, p_actor, p_draft);
  RETURN s;
END $$;

-- P5-API3 PUT /v1/admin/services/{id}/versions/{v}: writes a draft (new version = latest + 1, or an existing draft).
-- p_draft: {title, summary, institution, online_url?, processing_time?, change_note, last_verified_on,
--           requirements: [{kind, position, text, amount_tnd?, source_ids}], office_ids: [...]}
CREATE FUNCTION catalogue.put_draft(p_service uuid, p_version integer, p_actor uuid, p_draft jsonb) RETURNS integer
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, catalogue AS $$
DECLARE v catalogue.service_version%ROWTYPE; latest integer; r jsonb;
BEGIN
  SELECT max(sv.version) INTO latest FROM catalogue.service_version sv WHERE sv.service_id = p_service;
  SELECT * INTO v FROM catalogue.service_version sv WHERE sv.service_id = p_service AND sv.version = p_version FOR UPDATE;
  IF FOUND THEN
    IF v.state <> 'draft' THEN RAISE EXCEPTION 'only a draft can be changed (this version is %)', v.state USING ERRCODE = '55000'; END IF;
    DELETE FROM catalogue.requirement rq WHERE rq.service_id = p_service AND rq.version = p_version;
    DELETE FROM catalogue.version_office vo WHERE vo.service_id = p_service AND vo.version = p_version;
    UPDATE catalogue.service_version sv SET title = p_draft->'title', summary = p_draft->'summary', institution = p_draft->'institution',
           online_url = p_draft->>'online_url', processing_time = p_draft->'processing_time', change_note = p_draft->>'change_note',
           last_verified_on = (p_draft->>'last_verified_on')::date, author = p_actor
     WHERE sv.service_id = p_service AND sv.version = p_version;
  ELSE
    IF p_version <> coalesce(latest, 0) + 1 THEN RAISE EXCEPTION 'the next version is %', coalesce(latest, 0) + 1 USING ERRCODE = '22023'; END IF;
    INSERT INTO catalogue.service_version (service_id, version, title, summary, institution, online_url, processing_time, change_note, last_verified_on, author)
    VALUES (p_service, p_version, p_draft->'title', p_draft->'summary', p_draft->'institution', p_draft->>'online_url', p_draft->'processing_time',
            p_draft->>'change_note', (p_draft->>'last_verified_on')::date, p_actor);
  END IF;
  FOR r IN SELECT * FROM jsonb_array_elements(coalesce(p_draft->'requirements', '[]'::jsonb)) LOOP
    INSERT INTO catalogue.requirement (service_id, version, kind, position, text, amount_tnd, source_ids)
    VALUES (p_service, p_version, r->>'kind', (r->>'position')::smallint, r->'text', (r->>'amount_tnd')::numeric,
            ARRAY(SELECT jsonb_array_elements_text(r->'source_ids'))::uuid[]);
  END LOOP;
  INSERT INTO catalogue.version_office (service_id, version, office_id)
  SELECT p_service, p_version, x::uuid FROM jsonb_array_elements_text(coalesce(p_draft->'office_ids', '[]'::jsonb)) x;
  RETURN p_version;
END $$;

-- Why a draft cannot go to review yet: empty when it is complete (P5-AC1, P5-F1).
CREATE FUNCTION catalogue.completeness(p_service uuid, p_version integer) RETURNS text[]
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, catalogue AS $$
  SELECT array_remove(ARRAY[
    CASE WHEN NOT EXISTS (SELECT FROM catalogue.requirement r WHERE r.service_id = p_service AND r.version = p_version AND r.kind = 'step') THEN 'no steps' END,
    CASE WHEN EXISTS (SELECT FROM catalogue.requirement r WHERE r.service_id = p_service AND r.version = p_version
                       AND EXISTS (SELECT FROM unnest(r.source_ids) s WHERE s NOT IN (SELECT id FROM catalogue.source_ref))) THEN 'a cited source does not exist' END,
    CASE WHEN (SELECT last_verified_on FROM catalogue.service_version v WHERE v.service_id = p_service AND v.version = p_version) IS NULL THEN 'no last-verified date' END,
    CASE WHEN (SELECT last_verified_on FROM catalogue.service_version v WHERE v.service_id = p_service AND v.version = p_version) > current_date THEN 'last-verified date in the future' END
  ], NULL)
$$;

CREATE FUNCTION catalogue.submit(p_service uuid, p_version integer, p_actor uuid) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, catalogue AS $$
DECLARE missing text[];
BEGIN
  missing := catalogue.completeness(p_service, p_version);
  IF cardinality(missing) > 0 THEN RAISE EXCEPTION 'incomplete: %', array_to_string(missing, '; ') USING ERRCODE = '22023'; END IF;
  UPDATE catalogue.service_version v SET state = 'in-review', submitted_at = now()
   WHERE v.service_id = p_service AND v.version = p_version AND v.state = 'draft';
  IF NOT FOUND THEN RAISE EXCEPTION 'not a draft' USING ERRCODE = '55000'; END IF;
  INSERT INTO catalogue.editorial_review (service_id, version, reviewer, decision) VALUES (p_service, p_version, p_actor, 'submitted');
END $$;

-- The canonical content of a version, as signed (P5-SEC2): stable key order, requirements by kind and position.
CREATE FUNCTION catalogue.canonical_content(p_service uuid, p_version integer) RETURNS jsonb
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, catalogue AS $$
  SELECT jsonb_build_object(
    'code', s.code, 'slug', s.slug, 'category', s.category, 'version', v.version,
    'title', v.title, 'summary', v.summary, 'institution', v.institution, 'online_url', v.online_url, 'processing_time', v.processing_time,
    'last_verified_on', v.last_verified_on, 'change_note', v.change_note,
    'requirements', coalesce((SELECT jsonb_agg(jsonb_build_object('kind', r.kind, 'position', r.position, 'text', r.text, 'amount_tnd', r.amount_tnd,
                                                                    'sources', (SELECT jsonb_agg(sr ORDER BY sr) FROM unnest(r.source_ids) sr))
                                               ORDER BY r.kind, r.position)
                              FROM catalogue.requirement r WHERE r.service_id = v.service_id AND r.version = v.version), '[]'::jsonb),
    'offices', coalesce((SELECT jsonb_agg(o.code ORDER BY o.code) FROM catalogue.version_office vo JOIN catalogue.office o ON o.id = vo.office_id
                          WHERE vo.service_id = v.service_id AND vo.version = v.version), '[]'::jsonb))
  FROM catalogue.service s JOIN catalogue.service_version v ON v.service_id = s.id
  WHERE s.id = p_service AND v.version = p_version
$$;

-- Four-eyes approval: another person than the author; the digest of the canonical content and its signature (made by
-- the application with the cell's content key) are fixed with the approval.
CREATE FUNCTION catalogue.approve(p_service uuid, p_version integer, p_actor uuid, p_digest bytea, p_signature text) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, catalogue AS $$
DECLARE v catalogue.service_version%ROWTYPE;
BEGIN
  SELECT * INTO v FROM catalogue.service_version sv WHERE sv.service_id = p_service AND sv.version = p_version FOR UPDATE;
  IF NOT FOUND OR v.state <> 'in-review' THEN RAISE EXCEPTION 'only a version in review can be approved' USING ERRCODE = '55000'; END IF;
  IF v.author = p_actor THEN RAISE EXCEPTION 'four-eyes: the author cannot approve their own version' USING ERRCODE = '42501'; END IF;
  IF p_digest <> sha256(convert_to(catalogue.canonical_content(p_service, p_version)::text, 'UTF8')) THEN
    RAISE EXCEPTION 'the signed digest is not the digest of this version' USING ERRCODE = '22023';
  END IF;
  UPDATE catalogue.service_version sv SET state = 'approved', approved_by = p_actor, approved_at = now(), content_digest = p_digest, signature = p_signature
   WHERE sv.service_id = p_service AND sv.version = p_version;
  INSERT INTO catalogue.editorial_review (service_id, version, reviewer, decision) VALUES (p_service, p_version, p_actor, 'approved');
END $$;

CREATE FUNCTION catalogue.request_changes(p_service uuid, p_version integer, p_actor uuid, p_comment text) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, catalogue AS $$
BEGIN
  UPDATE catalogue.service_version v SET state = 'draft', submitted_at = NULL
   WHERE v.service_id = p_service AND v.version = p_version AND v.state = 'in-review';
  IF NOT FOUND THEN RAISE EXCEPTION 'only a version in review' USING ERRCODE = '55000'; END IF;
  INSERT INTO catalogue.editorial_review (service_id, version, reviewer, decision, comment) VALUES (p_service, p_version, p_actor, 'changes-requested', p_comment);
END $$;

-- Publication: the approved version becomes the published one; the previous one is superseded (history kept).
CREATE FUNCTION catalogue.publish(p_service uuid, p_version integer, p_actor uuid) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, catalogue AS $$
DECLARE s catalogue.service%ROWTYPE; c jsonb;
BEGIN
  SELECT * INTO s FROM catalogue.service sv WHERE sv.id = p_service FOR UPDATE;
  UPDATE catalogue.service_version v SET state = 'published', published_at = now()
   WHERE v.service_id = p_service AND v.version = p_version AND v.state = 'approved';
  IF NOT FOUND THEN RAISE EXCEPTION 'only an approved version can be published' USING ERRCODE = '55000'; END IF;
  IF s.published_version IS NOT NULL THEN
    UPDATE catalogue.service_version v SET state = 'superseded' WHERE v.service_id = p_service AND v.version = s.published_version;
  END IF;
  UPDATE catalogue.service sv SET published_version = p_version WHERE sv.id = p_service;
  c := catalogue.canonical_content(p_service, p_version);
  INSERT INTO catalogue.search_document (service_id, document)
  VALUES (p_service,
          setweight(to_tsvector('simple', catalogue.normalise(coalesce(c->'title'->>'ar', '') || ' ' || coalesce(c->'title'->>'fr', '') || ' ' || coalesce(c->'title'->>'en', ''))), 'A') ||
          setweight(to_tsvector('simple', catalogue.normalise(coalesce(c->'summary'->>'ar', '') || ' ' || coalesce(c->'summary'->>'fr', '') || ' ' || coalesce(c->'summary'->>'en', ''))), 'B') ||
          setweight(to_tsvector('simple', catalogue.normalise((SELECT string_agg(coalesce(r->'text'->>'ar', '') || ' ' || coalesce(r->'text'->>'fr', ''), ' ') FROM jsonb_array_elements(c->'requirements') r))), 'C'))
  ON CONFLICT (service_id) DO UPDATE SET document = EXCLUDED.document;
  INSERT INTO catalogue.editorial_review (service_id, version, reviewer, decision) VALUES (p_service, p_version, p_actor, 'published');
END $$;

CREATE FUNCTION catalogue.report_error(p_code text, p_version integer, p_message text) RETURNS uuid
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

-- Search over published services (P5-D4): normalised query, ranked, at most 50.
CREATE FUNCTION catalogue.search(p_query text, p_limit integer)
  RETURNS TABLE (code text, slug text, rank real)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, catalogue AS $$
  SELECT s.code, s.slug, ts_rank(d.document, q) AS rank
    FROM catalogue.search_document d JOIN catalogue.service s ON s.id = d.service_id,
         plainto_tsquery('simple', catalogue.normalise(p_query)) q
   WHERE s.published_version IS NOT NULL AND d.document @@ q
   ORDER BY rank DESC, s.code
   LIMIT least(greatest(p_limit, 1), 50)
$$;

-- Read access: published content only, as views (the application role reads no draft).
CREATE VIEW catalogue.published_version AS
  SELECT s.code, s.slug, s.category, v.* FROM catalogue.service s JOIN catalogue.service_version v ON v.service_id = s.id AND v.state IN ('published', 'superseded');
CREATE VIEW catalogue.published_requirement AS
  SELECT r.* FROM catalogue.requirement r JOIN catalogue.service_version v ON v.service_id = r.service_id AND v.version = r.version AND v.state IN ('published', 'superseded');

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA catalogue FROM PUBLIC;
GRANT USAGE ON SCHEMA catalogue TO civora_core_app;
GRANT SELECT ON catalogue.published_version, catalogue.published_requirement, catalogue.source_ref, catalogue.office TO civora_core_app;
GRANT EXECUTE ON FUNCTION catalogue.normalise(text), catalogue.add_source(text, text, text, text, text, text, date),
  catalogue.add_office(text, jsonb, jsonb, text, jsonb, numeric, numeric, jsonb, uuid, date),
  catalogue.create_service(text, text, text, uuid, jsonb), catalogue.put_draft(uuid, integer, uuid, jsonb), catalogue.completeness(uuid, integer),
  catalogue.submit(uuid, integer, uuid), catalogue.canonical_content(uuid, integer), catalogue.approve(uuid, integer, uuid, bytea, text),
  catalogue.request_changes(uuid, integer, uuid, text), catalogue.publish(uuid, integer, uuid), catalogue.report_error(text, integer, text),
  catalogue.search(text, integer) TO civora_core_app;

-- Down Migration
DROP SCHEMA catalogue CASCADE;
