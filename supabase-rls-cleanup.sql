-- Cosmetic cleanup: screen_owner_all and org_owner_all duplicate the
-- more specific per-command policies (same EXISTS/owner_id predicate,
-- just scoped to ALL instead of individual SELECT/INSERT/UPDATE/DELETE).
-- Not a security issue either way - just noise. Safe to drop since every
-- command they'd cover is already handled by a narrower policy.

DROP POLICY IF EXISTS "screen_owner_all" ON public.screens;
DROP POLICY IF EXISTS "org_owner_all" ON public.organisations;
