import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { NO_ROWS } from '@/lib/supabase/errors'

function loginWithError(origin: string, message: string) {
    const url = new URL('/login', origin)
    url.searchParams.set('error', message)
    return NextResponse.redirect(url)
}

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const next = searchParams.get('next') ?? '/dashboard'

    if (code) {
        const supabase = await createClient()
        // A failed exchange used to be ignored, so the user was redirected
        // to /dashboard with no session and bounced back to /login with no
        // explanation of what went wrong
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (exchangeError) {
            console.error('Auth code exchange failed:', exchangeError)
            return loginWithError(origin, 'That sign-in link is invalid or has expired — request a new one')
        }

        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
            console.error('Auth callback could not load the signed-in user:', userError)
            return loginWithError(origin, 'Could not complete sign-in — try again')
        }

        const { data: org, error: orgError } = await supabase
            .from('organisations')
            .select('id')
            .eq('owner_id', user.id)
            .single()

        if (orgError && orgError.code !== NO_ROWS) {
            console.error('Org fetch error:', orgError)
            return loginWithError(origin, 'Could not load your account — try again')
        }

        if (!org) {
            const businessName = user.user_metadata?.business_name || 'My Business'
            const { error: insertError } = await supabase
                .from('organisations')
                .insert({
                    owner_id: user.id,
                    name: businessName,
                    plan: 'free',
                })
            // Without an org the dashboard can't render, so this can't be
            // logged-and-forgotten
            if (insertError) {
                console.error('Org insert error:', insertError)
                return loginWithError(origin, 'Could not finish setting up your account — try again')
            }
        }
    }

    return NextResponse.redirect(`${origin}${next}`)
}
