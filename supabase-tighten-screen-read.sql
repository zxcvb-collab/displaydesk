-- The blanket "Anonymous users can read screens by PIN" policy used
-- USING (true), which grants read access to EVERY row regardless of which
-- column the caller filtered on — RLS can't distinguish "queried by pin"
-- from "queried by id". This let any authenticated user read any other
-- org's screen data by guessing/enumerating screen IDs directly.
--
-- Fix: drop the blanket policy and replace public read access with a
-- dedicated function that only supports exact-match PIN lookups, exposing
-- only the columns the TV player actually needs.

DROP POLICY IF EXISTS "Anonymous users can read screens by PIN" ON screens;

CREATE OR REPLACE FUNCTION public.get_screen_by_pin(p_pin text)
RETURNS TABLE (id uuid, name text, pin text, slides jsonb)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT s.id, s.name, s.pin, s.slides
    FROM screens s
    WHERE s.pin = p_pin
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_screen_by_pin(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_screen_by_pin(text) TO anon, authenticated;
