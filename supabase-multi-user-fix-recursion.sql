-- Fixes infinite recursion (42P17) introduced by supabase-multi-user.sql:
-- org_members' own SELECT policy queried org_members again inside itself,
-- and it and organisations' SELECT policy referenced each other. Postgres
-- detects this and errors on ANY query touching either table — this broke
-- all organisation/screen access, not just the new multi-user paths.
--
-- Fix: SECURITY DEFINER helper functions bypass RLS internally, breaking
-- the recursive cycle. Standard pattern for "check membership without
-- re-triggering the membership table's own RLS."

CREATE OR REPLACE FUNCTION public.owned_org_id(p_user_id uuid)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
    SELECT id FROM organisations WHERE owner_id = p_user_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.member_org_id(p_user_id uuid)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
    SELECT org_id FROM org_members WHERE user_id = p_user_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.user_org_id(p_user_id uuid)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
    SELECT coalesce(public.owned_org_id(p_user_id), public.member_org_id(p_user_id))
$$;

REVOKE ALL ON FUNCTION public.owned_org_id(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.member_org_id(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_org_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owned_org_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.member_org_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_org_id(uuid) TO authenticated;

-- org_members: replace the self-referencing SELECT policy
DROP POLICY IF EXISTS "Members can read their org's membership" ON public.org_members;
CREATE POLICY "Members can read their org's membership"
    ON public.org_members FOR SELECT
    USING (org_id = public.user_org_id(auth.uid()));

DROP POLICY IF EXISTS "Owners can add members to their org" ON public.org_members;
CREATE POLICY "Owners can add members to their org"
    ON public.org_members FOR INSERT
    WITH CHECK (org_id = public.owned_org_id(auth.uid()));

DROP POLICY IF EXISTS "Owners can remove members from their org" ON public.org_members;
CREATE POLICY "Owners can remove members from their org"
    ON public.org_members FOR DELETE
    USING (org_id = public.owned_org_id(auth.uid()));

-- org_invites
DROP POLICY IF EXISTS "Owners can manage invites for their org" ON public.org_invites;
CREATE POLICY "Owners can manage invites for their org"
    ON public.org_invites FOR ALL
    USING (org_id = public.owned_org_id(auth.uid()))
    WITH CHECK (org_id = public.owned_org_id(auth.uid()));

-- organisations SELECT
DROP POLICY IF EXISTS "Owners and members can read their organisation" ON public.organisations;
CREATE POLICY "Owners and members can read their organisation"
    ON public.organisations FOR SELECT
    USING (id = public.user_org_id(auth.uid()));

-- screens: all four commands
DROP POLICY IF EXISTS "Owners and members can read their org's screens" ON public.screens;
CREATE POLICY "Owners and members can read their org's screens"
    ON public.screens FOR SELECT
    USING (org_id = public.user_org_id(auth.uid()));

DROP POLICY IF EXISTS "Owners and members can create screens in their org" ON public.screens;
CREATE POLICY "Owners and members can create screens in their org"
    ON public.screens FOR INSERT
    WITH CHECK (org_id = public.user_org_id(auth.uid()));

DROP POLICY IF EXISTS "Owners and members can update their org's screens" ON public.screens;
CREATE POLICY "Owners and members can update their org's screens"
    ON public.screens FOR UPDATE
    USING (org_id = public.user_org_id(auth.uid()));

DROP POLICY IF EXISTS "Owners and members can delete their org's screens" ON public.screens;
CREATE POLICY "Owners and members can delete their org's screens"
    ON public.screens FOR DELETE
    USING (org_id = public.user_org_id(auth.uid()));

-- screen_activity
DROP POLICY IF EXISTS "Owners and members can read their org's activity" ON public.screen_activity;
CREATE POLICY "Owners and members can read their org's activity"
    ON public.screen_activity FOR SELECT
    USING (org_id = public.user_org_id(auth.uid()));

DROP POLICY IF EXISTS "Owners and members can log activity for their org" ON public.screen_activity;
CREATE POLICY "Owners and members can log activity for their org"
    ON public.screen_activity FOR INSERT
    WITH CHECK (org_id = public.user_org_id(auth.uid()));

-- storage.objects (videos bucket)
DROP POLICY IF EXISTS "Owners and members can upload videos to their org bucket" ON storage.objects;
CREATE POLICY "Owners and members can upload videos to their org bucket"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'videos'
        AND (storage.foldername(objects.name))[1] = public.user_org_id(auth.uid())::text
    );

DROP POLICY IF EXISTS "Owners and members can read videos from their org bucket" ON storage.objects;
CREATE POLICY "Owners and members can read videos from their org bucket"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'videos'
        AND (storage.foldername(objects.name))[1] = public.user_org_id(auth.uid())::text
    );

DROP POLICY IF EXISTS "Owners and members can delete their org videos" ON storage.objects;
CREATE POLICY "Owners and members can delete their org videos"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'videos'
        AND (storage.foldername(objects.name))[1] = public.user_org_id(auth.uid())::text
    );
