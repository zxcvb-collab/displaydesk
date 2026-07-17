import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripe, PRICE_ID_TO_PLAN, isPaidPlan, syncScreenAddon } from '@/lib/stripe'
import type Stripe from 'stripe'

// Subscriptions can now have two line items (base plan + add-on screens) -
// must find the base plan item specifically, not just take index 0.
function findPlan(subscription: Stripe.Subscription) {
    const item = subscription.items.data.find((i) => i.price.id in PRICE_ID_TO_PLAN)
    return item ? PRICE_ID_TO_PLAN[item.price.id] : undefined
}

async function syncAddonForOrg(supabase: ReturnType<typeof createAdminClient>, orgId: string, plan: string, subscriptionId: string) {
    if (!isPaidPlan(plan)) return
    const { count } = await supabase.from('screens').select('*', { count: 'exact', head: true }).eq('org_id', orgId)
    try {
        await syncScreenAddon(subscriptionId, plan, count ?? 0)
    } catch (err) {
        console.error('Failed to sync screen add-on billing after plan change:', err)
    }
}

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
            const plan = findPlan(subscription)
            if (!plan) break

            // Upgrading fully restores access and clears the free-tier
            // lifecycle state — no partial credit for time already elapsed
            await supabase
                .from('organisations')
                .update({
                    plan,
                    stripe_subscription_id: subscriptionId,
                    status: 'active',
                    trial_warning_sent_at: null,
                    deletion_warning_sent_at: null,
                })
                .eq('id', orgId)

            await syncAddonForOrg(supabase, orgId, plan, subscriptionId)
            break
        }

        case 'customer.subscription.updated': {
            const subscription = event.data.object as Stripe.Subscription
            const plan = findPlan(subscription)
            if (!plan) break

            const { data: org } = await supabase
                .from('organisations')
                .update({ plan, status: 'active', trial_warning_sent_at: null, deletion_warning_sent_at: null })
                .eq('stripe_customer_id', subscription.customer as string)
                .select('id')
                .single()

            // Plan may have changed (e.g. Pro -> Starter), which changes
            // the included screen count — re-sync the add-on quantity
            if (org) await syncAddonForOrg(supabase, org.id, plan, subscription.id)
            break
        }

        case 'customer.subscription.deleted': {
            const subscription = event.data.object as Stripe.Subscription
            // Reverting to free starts a fresh trial clock rather than
            // treating them as already 3-9 months into a trial they never
            // actually used as a free user
            await supabase
                .from('organisations')
                .update({
                    plan: 'free',
                    stripe_subscription_id: null,
                    status: 'active',
                    trial_started_at: new Date().toISOString(),
                    trial_warning_sent_at: null,
                    deletion_warning_sent_at: null,
                })
                .eq('stripe_customer_id', subscription.customer as string)
            break
        }
    }

    return NextResponse.json({ received: true })
}
