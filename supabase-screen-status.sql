-- Track live status per screen: last_seen_at already existed (unused);
-- adding current_slide_index so the dashboard can show what's playing.
ALTER TABLE public.screens ADD COLUMN IF NOT EXISTS current_slide_index integer;

-- Anonymous TVs report their heartbeat + current slide on every content
-- poll. SECURITY DEFINER, PIN-scoped only (same threat model as
-- get_screen_by_pin — the caller must already know the exact PIN, no
-- enumeration path).
CREATE OR REPLACE FUNCTION public.report_screen_heartbeat(p_pin text, p_slide_index int DEFAULT NULL)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE screens
    SET last_seen_at = now(),
        current_slide_index = coalesce(p_slide_index, current_slide_index)
    WHERE pin = p_pin;
$$;

REVOKE ALL ON FUNCTION public.report_screen_heartbeat(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_screen_heartbeat(text, int) TO anon, authenticated;
