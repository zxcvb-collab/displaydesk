-- Real bug, not a typo: user_org_id() used coalesce(owned_org_id, member_org_id),
-- prioritizing ownership. But every signup auto-creates a personal org via
-- the handle_new_user trigger — so any invited member ALSO owns their own
-- org, and user_org_id() always resolved to that empty personal org,
-- never the org they were actually invited to. Multi-user invites did not
-- work as deployed.
--
-- Fix: RLS policies now check ownership OR membership explicitly (not a
-- single coalesced scalar), so access is granted correctly regardless of
-- which one exists. This is a correctness fix independent of which org
-- the dashboard chooses to display (that priority is a separate,
-- application-level decision — see lib/org/index.ts).

DROP POLICY IF EXISTS "Members can read their org's membership" ON public.org_members;
CREATE POLICY "Members can read their org's membership"
    ON public.org_members FOR SELECT
    USING (org_id = public.owned_org_id(auth.uid()) OR org_id = public.member_org_id(auth.uid()));

DROP POLICY IF EXISTS "Owners and members can read their organisation" ON public.organisations;
CREATE POLICY "Owners and members can read their organisation"
    ON public.organisations FOR SELECT
    USING (id = public.owned_org_id(auth.uid()) OR id = public.member_org_id(auth.uid()));

DROP POLICY IF EXISTS "Owners and members can read their org's screens" ON public.screens;
CREATE POLICY "Owners and members can read their org's screens"
    ON public.screens FOR SELECT
    USING (org_id = public.owned_org_id(auth.uid()) OR org_id = public.member_org_id(auth.uid()));

DROP POLICY IF EXISTS "Owners and members can create screens in their org" ON public.screens;
CREATE POLICY "Owners and members can create screens in their org"
    ON public.screens FOR INSERT
    WITH CHECK (org_id = public.owned_org_id(auth.uid()) OR org_id = public.member_org_id(auth.uid()));

DROP POLICY IF EXISTS "Owners and members can update their org's screens" ON public.screens;
CREATE POLICY "Owners and members can update their org's screens"
    ON public.screens FOR UPDATE
    USING (org_id = public.owned_org_id(auth.uid()) OR org_id = public.member_org_id(auth.uid()));

DROP POLICY IF EXISTS "Owners and members can delete their org's screens" ON public.screens;
CREATE POLICY "Owners and members can delete their org's screens"
    ON public.screens FOR DELETE
    USING (org_id = public.owned_org_id(auth.uid()) OR org_id = public.member_org_id(auth.uid()));

DROP POLICY IF EXISTS "Owners and members can read their org's activity" ON public.screen_activity;
CREATE POLICY "Owners and members can read their org's activity"
    ON public.screen_activity FOR SELECT
    USING (org_id = public.owned_org_id(auth.uid()) OR org_id = public.member_org_id(auth.uid()));

DROP POLICY IF EXISTS "Owners and members can log activity for their org" ON public.screen_activity;
CREATE POLICY "Owners and members can log activity for their org"
    ON public.screen_activity FOR INSERT
    WITH CHECK (org_id = public.owned_org_id(auth.uid()) OR org_id = public.member_org_id(auth.uid()));

DROP POLICY IF EXISTS "Owners and members can upload videos to their org bucket" ON storage.objects;
CREATE POLICY "Owners and members can upload videos to their org bucket"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'videos'
        AND (
            (storage.foldername(objects.name))[1] = public.owned_org_id(auth.uid())::text
            OR (storage.foldername(objects.name))[1] = public.member_org_id(auth.uid())::text
        )
    );

DROP POLICY IF EXISTS "Owners and members can read videos from their org bucket" ON storage.objects;
CREATE POLICY "Owners and members can read videos from their org bucket"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'videos'
        AND (
            (storage.foldername(objects.name))[1] = public.owned_org_id(auth.uid())::text
            OR (storage.foldername(objects.name))[1] = public.member_org_id(auth.uid())::text
        )
    );

DROP POLICY IF EXISTS "Owners and members can delete their org videos" ON storage.objects;
CREATE POLICY "Owners and members can delete their org videos"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'videos'
        AND (
            (storage.foldername(objects.name))[1] = public.owned_org_id(auth.uid())::text
            OR (storage.foldername(objects.name))[1] = public.member_org_id(auth.uid())::text
        )
    );
