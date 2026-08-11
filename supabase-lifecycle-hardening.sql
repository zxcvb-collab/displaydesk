-- Corrective migration for the free-tier lifecycle (supabase-lifecycle.sql).
--
-- 1. The original trial_started_at backfill never ran. `ADD COLUMN ... NOT
--    NULL DEFAULT now()` fills every existing row with now(), so the
--    follow-up `UPDATE ... WHERE trial_started_at IS NULL` matched nothing
--    and existing orgs' trial clocks silently restarted at migration time
--    instead of counting from signup. Re-point any org whose clock is
--    still later than its signup date and that has never been warned or
--    disabled (i.e. nothing has acted on the wrong value yet).
--
-- 2. `status` is the enforcement flag for the lifecycle, but authenticated
--    users hold a blanket UPDATE grant on organisations, so a disabled
--    owner could re-enable themselves (and set their own plan) with a
--    single client-side update. Restrict the grant to the columns the
--    dashboard actually edits; everything else moves through the
--    service-role client, which bypasses RLS.

UPDATE public.organisations
SET trial_started_at = created_at
WHERE trial_started_at > created_at
  AND trial_warning_sent_at IS NULL
  AND deletion_warning_sent_at IS NULL
  AND status = 'active';

REVOKE UPDATE ON public.organisations FROM authenticated;
GRANT UPDATE (name, default_schedule) ON public.organisations TO authenticated;
