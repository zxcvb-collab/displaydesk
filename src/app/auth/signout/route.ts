import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
    const supabase = await createClient()
    const { error } = await supabase.auth.signOut()

    // The session cookies may still be valid, in which case middleware
    // bounces the user straight back to the dashboard — tell them why
    // instead of looping silently
    if (error) {
        console.error('Sign-out failed:', error)
        const url = new URL('/dashboard', request.url)
        url.searchParams.set('error', 'Could not sign you out — try again')
        return NextResponse.redirect(url, 303)
    }

    return NextResponse.redirect(new URL('/login', request.url), 303)
}
