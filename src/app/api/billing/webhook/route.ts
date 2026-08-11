import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripe, PRICE_ID_TO_PLAN, isPaidPlan, syncScreenAddon } from '@/lib/stripe'
import { NO_ROWS } from '@/lib/supabase/errors'
import type Stripe from 'stripe'

// Subscriptions can now have two line items (base plan + add-on screens) -
// must find the base plan item specifically, not just take index 0.
function findPlan(subscription: Stripe.Subscription) {
    const item = subscription.items.data.find((i) => i.price.id in PRICE_ID_TO_PLAN)
    return item ? PRICE_ID_TO_PLAN[item.price.id] : undefined
}

async function syncAddonForOrg(supabase: ReturnType<typeof createAdminClient>, orgId: string, plan: string, subscriptionId: string) {
    if (!isPaidPlan(plan)) return
    const { count, error } = await supabase.from('screens').select('*', { count: 'exact', head: true }).eq('org_id', orgId)
    if (error) throw new Error(`Failed to count screens for org ${orgId}: ${error.message}`)
    await syncScreenAddon(subscriptionId, plan, count ?? 0)
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

    // Anything that goes wrong below leaves a paying customer on the wrong
    // plan, so failures are reported as 5xx and Stripe retries the event
    // (every handler here is idempotent) instead of being logged and
    // acknowledged with a 200.
    try {
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
                const { error } = await supabase
                    .from('organisations')
                    .update({
                        plan,
                        stripe_subscription_id: subscriptionId,
                        status: 'active',
                        trial_warning_sent_at: null,
                        deletion_warning_sent_at: null,
                    })
                    .eq('id', orgId)
                if (error) throw new Error(`Failed to apply plan ${plan} to org ${orgId}: ${error.message}`)

                await syncAddonForOrg(supabase, orgId, plan, subscriptionId)
                break
            }

            case 'customer.subscription.updated': {
                const subscription = event.data.object as Stripe.Subscription
                const plan = findPlan(subscription)
                if (!plan) break

                const { data: org, error } = await supabase
                    .from('organisations')
                    .update({ plan, status: 'active', trial_warning_sent_at: null, deletion_warning_sent_at: null })
                    .eq('stripe_customer_id', subscription.customer as string)
                    .select('id')
                    .single()
                if (error && error.code !== NO_ROWS) {
                    throw new Error(`Failed to apply plan ${plan} for customer ${subscription.customer}: ${error.message}`)
                }
                if (!org) {
                    // Not a customer we know about — retrying won't help
                    console.warn(`No org found for Stripe customer ${subscription.customer}; ignoring ${event.type}`)
                    break
                }

                // Plan may have changed (e.g. Pro -> Starter), which changes
                // the included screen count — re-sync the add-on quantity
                await syncAddonForOrg(supabase, org.id, plan, subscription.id)
                break
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription
                // Reverting to free starts a fresh trial clock rather than
                // treating them as already 3-9 months into a trial they never
                // actually used as a free user
                const { error } = await supabase
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
                if (error) {
                    throw new Error(`Failed to revert customer ${subscription.customer} to free: ${error.message}`)
                }
                break
            }
        }
    } catch (err) {
        console.error(`Failed to process Stripe webhook ${event.type} (${event.id}):`, err)
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
    }

    return NextResponse.json({ received: true })
}
