import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { includedScreens, isPaidPlan, syncScreenAddon } from '@/lib/stripe'
import { requireOrgContext } from '@/lib/api'

export async function POST(request: Request) {
    const origin = new URL(request.url).origin
    const supabase = await createClient()
    const ctx = await requireOrgContext(supabase)
    if ('response' in ctx) return ctx.response

    const { data: org, error: orgError } = await supabase
        .from('organisations')
        .select('id, plan, status, stripe_subscription_id')
        .eq('id', ctx.orgId)
        .single()

    if (orgError) {
        console.error('Failed to load organisation:', orgError)
        return NextResponse.json({ error: 'Could not load your organisation' }, { status: 500 })
    }
    if (!org) return NextResponse.json({ error: 'No organisation found' }, { status: 404 })
    if (org.status === 'disabled') return NextResponse.redirect(new URL('/dashboard', origin), 302)

    const { count, error: countError } = await supabase
        .from('screens')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', org.id)

    if (countError) {
        console.error('Failed to count screens:', countError)
        return NextResponse.json({ error: 'Could not check your screen count' }, { status: 500 })
    }

    // Free tier is hard-capped, no path to add more without upgrading.
    // Paid tiers can go beyond their included count - the extra screens
    // are billed as an add-on (synced to Stripe below), not blocked.
    if (org.plan === 'free' && (count ?? 0) >= includedScreens(org.plan)) {
        return NextResponse.redirect(new URL('/dashboard', origin), 302)
    }

    // Generate unique PIN
    const { data: pin, error: pinError } = await supabase.rpc('generate_unique_pin')

    if (pinError || !pin) {
        console.error('Failed to generate screen PIN:', pinError)
        return NextResponse.json({ error: 'Could not generate a PIN for this screen' }, { status: 500 })
    }

    const { data: screen, error } = await supabase
        .from('screens')
        .insert({ org_id: org.id, pin, slides: [], name: '' })
        .select()
        .single()

    if (error) {
        console.error('Failed to create screen:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (isPaidPlan(org.plan) && org.stripe_subscription_id) {
        try {
            await syncScreenAddon(org.stripe_subscription_id, org.plan, (count ?? 0) + 1)
        } catch (err) {
            // The screen exists either way — billing is reconciled on the
            // next add/remove or plan change, so don't fail the request
            console.error('Failed to sync screen add-on billing:', err)
        }
    }

    return NextResponse.redirect(
        new URL(`/screens/${screen.id}`, origin),
        302
    )
}
