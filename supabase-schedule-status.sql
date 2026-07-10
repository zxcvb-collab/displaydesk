-- Surface "closed for business hours" as a distinct dashboard state.
-- The TV already evaluates open/closed locally using its own clock, so
-- rather than duplicating that logic server-side (which would require
-- guessing the business's timezone — the server runs on Vercel's clock,
-- not the TV's), have the TV self-report its computed state as part of
-- its existing heartbeat.

ALTER TABLE public.screens ADD COLUMN IF NOT EXISTS is_open boolean NOT NULL DEFAULT true;

DROP FUNCTION IF EXISTS public.report_screen_heartbeat(text, int);

CREATE FUNCTION public.report_screen_heartbeat(p_pin text, p_slide_index int DEFAULT NULL, p_is_open boolean DEFAULT NULL)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE screens
    SET last_seen_at = now(),
        current_slide_index = coalesce(p_slide_index, current_slide_index),
        is_open = coalesce(p_is_open, is_open)
    WHERE pin = p_pin;
$$;

REVOKE ALL ON FUNCTION public.report_screen_heartbeat(text, int, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_screen_heartbeat(text, int, boolean) TO anon, authenticated;
