import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe, PLAN_PRICE_IDS, isPaidPlan } from '@/lib/stripe'

export async function POST(request: Request) {
    const url = new URL(request.url)
    const origin = url.origin
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: org } = await supabase
        .from('organisations')
        .select('id, plan, stripe_customer_id')
        .eq('owner_id', user.id)
        .single()

    if (!org) return NextResponse.json({ error: 'No organisation found' }, { status: 404 })

    const plan = url.searchParams.get('plan') ?? ''
    if (!isPaidPlan(plan)) {
        return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    let customerId = org.stripe_customer_id
    if (!customerId) {
        const customer = await stripe.customers.create({
            email: user.email,
            metadata: { org_id: org.id },
        })
        customerId = customer.id
        await supabase
            .from('organisations')
            .update({ stripe_customer_id: customerId })
            .eq('id', org.id)
    }

    const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        line_items: [{ price: PLAN_PRICE_IDS[plan], quantity: 1 }],
        success_url: `${origin}/dashboard?checkout=success`,
        cancel_url: `${origin}/dashboard?checkout=cancelled`,
        metadata: { org_id: org.id, plan },
    })

    if (!session.url) {
        return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
    }

    return NextResponse.redirect(session.url, 303)
}
