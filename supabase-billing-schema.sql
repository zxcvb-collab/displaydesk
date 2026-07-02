-- Stripe linkage columns for subscription billing
ALTER TABLE public.organisations
    ADD COLUMN IF NOT EXISTS stripe_customer_id text,
    ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

CREATE UNIQUE INDEX IF NOT EXISTS organisations_stripe_customer_id_idx
    ON public.organisations (stripe_customer_id)
    WHERE stripe_customer_id IS NOT NULL;

-- service_role was missing basic table grants (separate from RLS bypass —
-- RLS bypass alone doesn't substitute for the underlying GRANT). This was
-- discovered while testing and blocks any service-role script/webhook from
-- reading or writing these tables at all.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organisations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.screens TO service_role;
GRANT SELECT, INSERT ON public.screen_activity TO service_role;
