-- Up Migration
-- Phase 4 week 5: expiry reminders (P4-D5) with renewal deep-links (P4-F6). For each wallet entry, the reminder days
-- of its type (default 30 and 7 for types of other issuers) are crossed one by one; each threshold is sent once.
-- The application role cannot list other people's entries (row-level security): this function returns, across
-- people, only what a reminder needs, and records that it was sent. Doc phase-4/06.

COMMENT ON COLUMN wallet.credential.last_reminder_days IS 'P4-D5: the smallest reminder threshold (days before expiry) already sent; NULL = none.';

CREATE FUNCTION wallet.due_reminders(p_limit integer)
  RETURNS TABLE (entry_id uuid, person_id uuid, vct text, expires_at timestamptz, threshold integer, renewal_service_slug text, display jsonb)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, wallet AS $$
  SELECT c.id, c.person_id, c.vct, c.expires_at, th.d, t.renewal_service_slug, t.display
    FROM wallet.credential c
    LEFT JOIN wallet.credential_type t ON t.vct = c.vct
    CROSS JOIN LATERAL (
      SELECT min(d) AS d FROM unnest(coalesce(t.reminder_days, '{30,7}')) d
       WHERE c.expires_at <= now() + make_interval(days => d)
    ) th
   WHERE c.expires_at > now() AND th.d IS NOT NULL AND (c.last_reminder_days IS NULL OR c.last_reminder_days > th.d)
   ORDER BY c.expires_at
   LIMIT least(greatest(p_limit, 1), 500)
$$;

CREATE FUNCTION wallet.mark_reminded(p_entry uuid, p_threshold integer) RETURNS boolean
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, wallet AS $$
BEGIN
  UPDATE wallet.credential c SET last_reminder_days = p_threshold, updated_at = now()
   WHERE c.id = p_entry AND (c.last_reminder_days IS NULL OR c.last_reminder_days > p_threshold);
  RETURN FOUND;
END $$;

REVOKE ALL ON FUNCTION wallet.due_reminders(integer), wallet.mark_reminded(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION wallet.due_reminders(integer), wallet.mark_reminded(uuid, integer) TO civora_core_app;

-- Down Migration
DROP FUNCTION wallet.mark_reminded(uuid, integer);
DROP FUNCTION wallet.due_reminders(integer);
COMMENT ON COLUMN wallet.credential.last_reminder_days IS NULL;
