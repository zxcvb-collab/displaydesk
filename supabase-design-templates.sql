-- Design templates: user-saved reusable designs, scoped to an org so any
-- owner/member can save and reuse them. Mirrors the screens RLS pattern.

CREATE TABLE IF NOT EXISTS public.design_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    name text NOT NULL,
    design jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS design_templates_org_id_idx ON public.design_templates(org_id);

ALTER TABLE public.design_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners and members can read their org's design templates" ON public.design_templates;
CREATE POLICY "Owners and members can read their org's design templates"
    ON public.design_templates FOR SELECT
    USING (org_id = public.user_org_id(auth.uid()));

DROP POLICY IF EXISTS "Owners and members can create design templates in their org" ON public.design_templates;
CREATE POLICY "Owners and members can create design templates in their org"
    ON public.design_templates FOR INSERT
    WITH CHECK (org_id = public.user_org_id(auth.uid()));

DROP POLICY IF EXISTS "Owners and members can delete their org's design templates" ON public.design_templates;
CREATE POLICY "Owners and members can delete their org's design templates"
    ON public.design_templates FOR DELETE
    USING (org_id = public.user_org_id(auth.uid()));
