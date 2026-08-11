import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe, PLAN_PRICE_IDS, isPaidPlan } from '@/lib/stripe'
import { NO_ROWS } from '@/lib/supabase/errors'
import type Stripe from 'stripe'

export async function POST(request: Request) {
    const url = new URL(request.url)
    const origin = url.origin
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError) {
        console.error('Auth lookup failed:', authError)
        return NextResponse.json({ error: 'Could not verify your session' }, { status: 503 })
    }
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: org, error: orgError } = await supabase
        .from('organisations')
        .select('id, plan, stripe_customer_id')
        .eq('owner_id', user.id)
        .single()

    if (orgError && orgError.code !== NO_ROWS) {
        console.error('Failed to load organisation for checkout:', orgError)
        return NextResponse.json({ error: 'Could not load your organisation' }, { status: 503 })
    }
    if (!org) return NextResponse.json({ error: 'No organisation found' }, { status: 404 })

    const plan = url.searchParams.get('plan') ?? ''
    if (!isPaidPlan(plan)) {
        return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    let customerId = org.stripe_customer_id
    if (!customerId) {
        let customer: Stripe.Customer
        try {
            customer = await stripe.customers.create({
                email: user.email,
                metadata: { org_id: org.id },
            })
        } catch (err) {
            console.error('Stripe customer creation failed:', err)
            return NextResponse.json({ error: 'Could not reach our payment provider — try again' }, { status: 502 })
        }
        customerId = customer.id
        // Losing this write would orphan the customer and create a second
        // one on the next attempt, so it can't be fire-and-forget
        const { error: linkError } = await supabase
            .from('organisations')
            .update({ stripe_customer_id: customerId })
            .eq('id', org.id)
        if (linkError) {
            console.error('Failed to store Stripe customer id:', linkError)
            return NextResponse.json({ error: 'Could not start checkout — try again' }, { status: 500 })
        }
    }

    let session: Stripe.Checkout.Session
    try {
        session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            customer: customerId,
            line_items: [{ price: PLAN_PRICE_IDS[plan], quantity: 1 }],
            success_url: `${origin}/dashboard?checkout=success`,
            cancel_url: `${origin}/dashboard?checkout=cancelled`,
            metadata: { org_id: org.id, plan },
        })
    } catch (err) {
        console.error('Stripe checkout session creation failed:', err)
        return NextResponse.json({ error: 'Could not reach our payment provider — try again' }, { status: 502 })
    }

    if (!session.url) {
        return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
    }

    return NextResponse.redirect(session.url, 303)
}
