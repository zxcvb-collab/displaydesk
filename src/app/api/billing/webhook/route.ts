import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripe, PRICE_ID_TO_PLAN } from '@/lib/stripe'
import type Stripe from 'stripe'

export async function POST(request: Request) {
    const signature = request.headers.get('stripe-signature')
    const body = await request.text()

    if (!signature) {
        return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    let event: Stripe.Event
    try {
        event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
    } catch (err) {
        console.error('Webhook signature verification failed:', err)
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    const supabase = createAdminClient()

    switch (event.type) {
        case 'checkout.session.completed': {
            const session = event.data.object as Stripe.Checkout.Session
            const orgId = session.metadata?.org_id
            const subscriptionId = session.subscription as string
            if (!orgId || !subscriptionId) break

            const subscription = await stripe.subscriptions.retrieve(subscriptionId)
            const priceId = subscription.items.data[0]?.price.id
            const plan = priceId ? PRICE_ID_TO_PLAN[priceId] : undefined
            if (!plan) break

            await supabase
                .from('organisations')
                .update({ plan, stripe_subscription_id: subscriptionId })
                .eq('id', orgId)
            break
        }

        case 'customer.subscription.updated': {
            const subscription = event.data.object as Stripe.Subscription
            const priceId = subscription.items.data[0]?.price.id
            const plan = priceId ? PRICE_ID_TO_PLAN[priceId] : undefined
            if (!plan) break

            await supabase
                .from('organisations')
                .update({ plan })
                .eq('stripe_customer_id', subscription.customer as string)
            break
        }

        case 'customer.subscription.deleted': {
            const subscription = event.data.object as Stripe.Subscription
            await supabase
                .from('organisations')
                .update({ plan: 'free', stripe_subscription_id: null })
                .eq('stripe_customer_id', subscription.customer as string)
            break
        }
    }

    return NextResponse.json({ received: true })
}
