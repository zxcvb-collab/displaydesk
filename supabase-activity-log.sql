-- Per-screen activity log: tracks video uploads and deletions with who/when.
-- Append-only by design — no UPDATE/DELETE policies, so entries can't be
-- edited or removed once written (only SELECT and INSERT are granted).

CREATE TABLE IF NOT EXISTS public.screen_activity (
    id uuid primary key default gen_random_uuid(),
    screen_id uuid not null references public.screens(id) on delete cascade,
    org_id uuid not null references public.organisations(id) on delete cascade,
    action text not null check (action in ('upload', 'delete')),
    detail text,
    actor_email text,
    created_at timestamptz not null default now()
);

ALTER TABLE public.screen_activity ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.screen_activity TO authenticated;

CREATE POLICY "Users can read activity for their org's screens"
    ON public.screen_activity FOR SELECT
    USING (org_id IN (SELECT id FROM organisations WHERE owner_id = auth.uid()));

CREATE POLICY "Users can log activity for their org's screens"
    ON public.screen_activity FOR INSERT
    WITH CHECK (org_id IN (SELECT id FROM organisations WHERE owner_id = auth.uid()));

CREATE INDEX IF NOT EXISTS screen_activity_screen_id_idx ON public.screen_activity (screen_id, created_at DESC);
