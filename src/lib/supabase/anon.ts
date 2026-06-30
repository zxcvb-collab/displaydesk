import { createClient } from '@supabase/supabase-js'

// Use this for public routes that don't need user auth (e.g. TV player)
export function createAnonClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
}
