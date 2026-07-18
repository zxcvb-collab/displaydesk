import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { includedScreens, isPaidPlan, syncScreenAddon } from '@/lib/stripe'
import { resolveOrgId } from '@/lib/org'

export async function POST(request: Request) {
    const origin = new URL(request.url).origin
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const resolved = await resolveOrgId(supabase, user.id)
    if (!resolved) return NextResponse.json({ error: 'No organisation found' }, { status: 404 })

    const { data: org } = await supabase
        .from('organisations')
        .select('id, plan, status, stripe_subscription_id')
        .eq('id', resolved.orgId)
        .single()

    if (!org) return NextResponse.json({ error: 'No organisation found' }, { status: 404 })
    if (org.status === 'disabled') return NextResponse.redirect(new URL('/dashboard', origin), 302)

    const { count } = await supabase
        .from('screens')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', org.id)

    // Free tier is hard-capped, no path to add more without upgrading.
    // Paid tiers can go beyond their included count - the extra screens
    // are billed as an add-on (synced to Stripe below), not blocked.
    if (org.plan === 'free' && (count ?? 0) >= includedScreens(org.plan)) {
        return NextResponse.redirect(new URL('/dashboard', origin), 302)
    }

    // Generate unique PIN
    const { data: pin } = await supabase.rpc('generate_unique_pin')

    const { data: screen, error } = await supabase
        .from('screens')
        .insert({ org_id: org.id, pin, slides: [], name: '' })
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (isPaidPlan(org.plan) && org.stripe_subscription_id) {
        try {
            await syncScreenAddon(org.stripe_subscription_id, org.plan, (count ?? 0) + 1)
        } catch (err) {
            console.error('Failed to sync screen add-on billing:', err)
        }
    }

    return NextResponse.redirect(
        new URL(`/screens/${screen.id}`, origin),
        302
    )
}