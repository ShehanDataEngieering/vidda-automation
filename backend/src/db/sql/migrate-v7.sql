-- V7: Make plan_events (the audit trail) append-only.
--
-- 1. Drop the ON DELETE CASCADE FK to training_plans so deleting a plan (or its
--    company) no longer silently erases its audit history. plan_id stays indexed.
-- 2. Reject UPDATE / DELETE / TRUNCATE on plan_events with a trigger.
--
-- This blocks tampering through the application. It does not stop a database
-- owner/superuser, who can disable triggers — that needs separate DB roles.
-- Safe to re-run.

ALTER TABLE plan_events DROP CONSTRAINT IF EXISTS plan_events_plan_id_fkey;

CREATE OR REPLACE FUNCTION plan_events_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'plan_events is an append-only audit trail; % is not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS plan_events_no_update_delete ON plan_events;
CREATE TRIGGER plan_events_no_update_delete
  BEFORE UPDATE OR DELETE ON plan_events
  FOR EACH ROW EXECUTE FUNCTION plan_events_append_only();

DROP TRIGGER IF EXISTS plan_events_no_truncate ON plan_events;
CREATE TRIGGER plan_events_no_truncate
  BEFORE TRUNCATE ON plan_events
  FOR EACH STATEMENT EXECUTE FUNCTION plan_events_append_only();
