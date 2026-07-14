-- Free-tier lifecycle: 3-month trial -> warning -> soft-disable ->
-- 6-month grace period -> warning -> hard delete at month 9.

ALTER TABLE public.organisations
    ADD COLUMN IF NOT EXISTS trial_started_at timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    ADD COLUMN IF NOT EXISTS trial_warning_sent_at timestamptz,
    ADD COLUMN IF NOT EXISTS deletion_warning_sent_at timestamptz;

-- Backfill existing orgs' trial clock from their signup date, so nobody's
-- trial silently starts counting from "whenever this migration ran"
-- instead of when they actually signed up.
UPDATE public.organisations SET trial_started_at = created_at WHERE trial_started_at IS NULL;

-- Extend the public PIN-lookup RPC to also expose the org's lifecycle
-- status, so the TV can distinguish "disabled for non-payment" from
-- "closed for business hours" (§4.5) — same anonymous-access model,
-- must DROP first since the return shape is changing again.
DROP FUNCTION IF EXISTS public.get_screen_by_pin(text);

CREATE FUNCTION public.get_screen_by_pin(p_pin text)
RETURNS TABLE (
    id uuid,
    name text,
    pin text,
    slides jsonb,
    schedule_mode text,
    schedule jsonb,
    org_default_schedule jsonb,
    org_status text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT s.id, s.name, s.pin, s.slides, s.schedule_mode, s.schedule, o.default_schedule, o.status
    FROM screens s
    JOIN organisations o ON o.id = s.org_id
    WHERE s.pin = p_pin
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_screen_by_pin(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_screen_by_pin(text) TO anon, authenticated;
