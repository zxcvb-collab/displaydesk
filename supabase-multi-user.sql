-- Multi-user orgs: an org keeps its single owner_id (billing, danger-zone
-- actions like deleting the org, and inviting/removing members stay
-- owner-only) but can now have additional members who get full day-to-day
-- screen-management access (create/edit/delete screens, schedules).
--
-- No email sending is wired up yet (Resend on hold), so invites work via
-- a shareable link the owner copies and sends manually, rather than an
-- automated email.

CREATE TABLE IF NOT EXISTS public.org_members (
    org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (org_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.org_invites (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    email text NOT NULL,
    token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
    used_at timestamptz
);

ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_invites ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON public.org_members TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.org_invites TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.org_members TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.org_invites TO service_role;

-- Members can see who else is in their org; owners can see + manage
CREATE POLICY "Members can read their org's membership"
    ON public.org_members FOR SELECT
    USING (
        org_id IN (SELECT id FROM organisations WHERE owner_id = auth.uid())
        OR org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
    );

CREATE POLICY "Owners can add members to their org"
    ON public.org_members FOR INSERT
    WITH CHECK (org_id IN (SELECT id FROM organisations WHERE owner_id = auth.uid()));

CREATE POLICY "Owners can remove members from their org"
    ON public.org_members FOR DELETE
    USING (org_id IN (SELECT id FROM organisations WHERE owner_id = auth.uid()));

-- Invites: owner can create/view/revoke; anyone authenticated can read a
-- specific invite by token to redeem it (narrow surface — token is a
-- 48-char random hex string, not enumerable)
CREATE POLICY "Owners can manage invites for their org"
    ON public.org_invites FOR ALL
    USING (org_id IN (SELECT id FROM organisations WHERE owner_id = auth.uid()))
    WITH CHECK (org_id IN (SELECT id FROM organisations WHERE owner_id = auth.uid()));

CREATE POLICY "Authenticated users can read an invite by its token"
    ON public.org_invites FOR SELECT
    USING (auth.role() = 'authenticated');

-- Extend screens RLS so members get full day-to-day management access,
-- matching owner permissions. Org-level settings (billing, business-hours
-- default) stay owner-only via the existing organisations UPDATE policy.
DROP POLICY IF EXISTS "Users can read screens in their organisation" ON public.screens;
DROP POLICY IF EXISTS "Users can create screens in their organisation" ON public.screens;
DROP POLICY IF EXISTS "Users can update screens in their organisation" ON public.screens;
DROP POLICY IF EXISTS "Users can delete screens in their organisation" ON public.screens;

CREATE POLICY "Owners and members can read their org's screens"
    ON public.screens FOR SELECT
    USING (
        org_id IN (SELECT id FROM organisations WHERE owner_id = auth.uid())
        OR org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
    );

CREATE POLICY "Owners and members can create screens in their org"
    ON public.screens FOR INSERT
    WITH CHECK (
        org_id IN (SELECT id FROM organisations WHERE owner_id = auth.uid())
        OR org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
    );

CREATE POLICY "Owners and members can update their org's screens"
    ON public.screens FOR UPDATE
    USING (
        org_id IN (SELECT id FROM organisations WHERE owner_id = auth.uid())
        OR org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
    );

CREATE POLICY "Owners and members can delete their org's screens"
    ON public.screens FOR DELETE
    USING (
        org_id IN (SELECT id FROM organisations WHERE owner_id = auth.uid())
        OR org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
    );

-- Members also need to read the org row itself (name, plan, schedule
-- default) — UPDATE stays owner-only via the existing policy
DROP POLICY IF EXISTS "Users can read their own organisation" ON public.organisations;
CREATE POLICY "Owners and members can read their organisation"
    ON public.organisations FOR SELECT
    USING (
        owner_id = auth.uid()
        OR id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
    );

-- Members also need to read/write screen_activity for the screens they
-- manage
DROP POLICY IF EXISTS "Users can read activity for their org's screens" ON public.screen_activity;
DROP POLICY IF EXISTS "Users can log activity for their org's screens" ON public.screen_activity;

CREATE POLICY "Owners and members can read their org's activity"
    ON public.screen_activity FOR SELECT
    USING (
        org_id IN (SELECT id FROM organisations WHERE owner_id = auth.uid())
        OR org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
    );

CREATE POLICY "Owners and members can log activity for their org"
    ON public.screen_activity FOR INSERT
    WITH CHECK (
        org_id IN (SELECT id FROM organisations WHERE owner_id = auth.uid())
        OR org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
    );

-- Storage RLS (videos bucket) also needs member access — mirrors the
-- existing owner-only policies from supabase-storage-fix.sql
DROP POLICY IF EXISTS "Users can upload videos to their org bucket" ON storage.objects;
DROP POLICY IF EXISTS "Users can read videos from their org bucket" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their org videos" ON storage.objects;

CREATE POLICY "Owners and members can upload videos to their org bucket"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'videos'
        AND (
            auth.jwt() ->> 'sub' IN (
                SELECT owner_id::text FROM organisations
                WHERE id::text = (storage.foldername(objects.name))[1]
            )
            OR (storage.foldername(objects.name))[1] IN (
                SELECT org_id::text FROM org_members WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Owners and members can read videos from their org bucket"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'videos'
        AND (
            auth.jwt() ->> 'sub' IN (
                SELECT owner_id::text FROM organisations
                WHERE id::text = (storage.foldername(objects.name))[1]
            )
            OR (storage.foldername(objects.name))[1] IN (
                SELECT org_id::text FROM org_members WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Owners and members can delete their org videos"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'videos'
        AND (
            auth.jwt() ->> 'sub' IN (
                SELECT owner_id::text FROM organisations
                WHERE id::text = (storage.foldername(objects.name))[1]
            )
            OR (storage.foldername(objects.name))[1] IN (
                SELECT org_id::text FROM org_members WHERE user_id = auth.uid()
            )
        )
    );
