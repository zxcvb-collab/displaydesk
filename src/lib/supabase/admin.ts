import { createClient } from '@supabase/supabase-js'

// Service-role client for server-only contexts with no user session (e.g.
// Stripe webhooks). Bypasses RLS — never expose this key to the browser.
export function createAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}
