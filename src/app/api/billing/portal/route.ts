import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import { NO_ROWS } from '@/lib/supabase/errors'

export async function POST(request: Request) {
    const origin = new URL(request.url).origin
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError) {
        console.error('Auth lookup failed:', authError)
        return NextResponse.json({ error: 'Could not verify your session' }, { status: 503 })
    }
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: org, error: orgError } = await supabase
        .from('organisations')
        .select('stripe_customer_id')
        .eq('owner_id', user.id)
        .single()

    // Without this, a failed lookup told the owner they have no billing
    // account at all — which reads as "your subscription is gone"
    if (orgError && orgError.code !== NO_ROWS) {
        console.error('Failed to load organisation for billing portal:', orgError)
        return NextResponse.json({ error: 'Could not load your billing details' }, { status: 503 })
    }

    if (!org?.stripe_customer_id) {
        return NextResponse.json({ error: 'No billing account found' }, { status: 404 })
    }

    try {
        const session = await stripe.billingPortal.sessions.create({
            customer: org.stripe_customer_id,
            return_url: `${origin}/dashboard`,
        })
        return NextResponse.redirect(session.url, 303)
    } catch (err) {
        console.error('Stripe billing portal session creation failed:', err)
        return NextResponse.json({ error: 'Could not open the billing portal — try again' }, { status: 502 })
    }
}
