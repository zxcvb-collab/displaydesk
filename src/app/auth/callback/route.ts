import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    // Only same-origin relative paths — a raw `next` lets an attacker craft
    // a link that lands a freshly authenticated user on another site.
    const requestedNext = searchParams.get('next') ?? '/dashboard'
    const next = /^\/(?!\/|\\)/.test(requestedNext) ? requestedNext : '/dashboard'

    if (code) {
        const supabase = await createClient()
        await supabase.auth.exchangeCodeForSession(code)

        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            const { data: org, error: orgError } = await supabase
                .from('organisations')
                .select('id')
                .eq('owner_id', user.id)
                .single()

            if (!org) {
                const businessName = user.user_metadata?.business_name || 'My Business'
                const { error: insertError } = await supabase
                    .from('organisations')
                    .insert({
                        owner_id: user.id,
                        name: businessName,
                        plan: 'free',
                    })
                if (insertError) console.error('Org insert error:', insertError)
            }
            if (orgError && orgError.code !== 'PGRST116') console.error('Org fetch error:', orgError)
        }
    }

    return NextResponse.redirect(`${origin}${next}`)
}