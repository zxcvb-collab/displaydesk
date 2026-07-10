-- Business-hours scheduling. A schedule is a JSON object with one key per
-- day (mon..sun); each value is either null (closed that day) or
-- { "open": "HH:MM", "close": "HH:MM" } in 24h local time. Evaluated
-- entirely client-side on the TV using its own system clock — no server
-- cron needed.

ALTER TABLE public.organisations ADD COLUMN IF NOT EXISTS default_schedule jsonb;

ALTER TABLE public.screens
    ADD COLUMN IF NOT EXISTS schedule_mode text NOT NULL DEFAULT 'inherit'
        CHECK (schedule_mode IN ('inherit', 'custom', 'always_on')),
    ADD COLUMN IF NOT EXISTS schedule jsonb;

-- Extend the public PIN-lookup RPC to also expose schedule info, so the
-- TV player can evaluate open/closed state without any additional
-- authenticated request.
CREATE OR REPLACE FUNCTION public.get_screen_by_pin(p_pin text)
RETURNS TABLE (
    id uuid,
    name text,
    pin text,
    slides jsonb,
    schedule_mode text,
    schedule jsonb,
    org_default_schedule jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT s.id, s.name, s.pin, s.slides, s.schedule_mode, s.schedule, o.default_schedule
    FROM screens s
    JOIN organisations o ON o.id = s.org_id
    WHERE s.pin = p_pin
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_screen_by_pin(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_screen_by_pin(text) TO anon, authenticated;
