import { NextResponse } from 'next/server'
import { jsonError, requireOrgRecord } from '@/lib/api/server'
import { countScreens, includedScreens, syncScreenAddonForOrg } from '@/lib/stripe'

export async function POST(request: Request) {
    const origin = new URL(request.url).origin
    const auth = await requireOrgRecord({ allowDisabled: true })
    if (!auth.ok) return auth.response
    const { supabase, org } = auth.value

    if (org.status === 'disabled') return NextResponse.redirect(new URL('/dashboard', origin), 302)

    const count = await countScreens(supabase, org.id)

    // Free tier is hard-capped, no path to add more without upgrading.
    // Paid tiers can go beyond their included count - the extra screens
    // are billed as an add-on (synced to Stripe below), not blocked.
    if (org.plan === 'free' && count >= includedScreens(org.plan)) {
        return NextResponse.redirect(new URL('/dashboard', origin), 302)
    }

    // Generate unique PIN
    const { data: pin } = await supabase.rpc('generate_unique_pin')

    const { data: screen, error } = await supabase
        .from('screens')
        .insert({ org_id: org.id, pin, slides: [], name: '' })
        .select()
        .single()

    if (error) return jsonError(error.message, 500)

    await syncScreenAddonForOrg(supabase, org.id, org.plan, org.stripe_subscription_id, count + 1)

    return NextResponse.redirect(
        new URL(`/screens/${screen.id}`, origin),
        302
    )
}
