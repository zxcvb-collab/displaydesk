import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSameOrigin } from '@/lib/security'

export async function POST(request: Request) {
    if (!isSameOrigin(request)) {
        return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
    }

    const supabase = await createClient()
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/login', request.url), 303)
}