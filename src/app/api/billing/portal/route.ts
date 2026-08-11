import { NextResponse } from 'next/server'
import { jsonError, requireUser } from '@/lib/api/server'
import { stripe } from '@/lib/stripe'

export async function POST(request: Request) {
    const origin = new URL(request.url).origin
    const auth = await requireUser()
    if (!auth.ok) return auth.response
    const { supabase, user } = auth.value

    const { data: org } = await supabase
        .from('organisations')
        .select('stripe_customer_id')
        .eq('owner_id', user.id)
        .single()

    if (!org?.stripe_customer_id) {
        return jsonError('No billing account found', 404)
    }

    const session = await stripe.billingPortal.sessions.create({
        customer: org.stripe_customer_id,
        return_url: `${origin}/dashboard`,
    })

    return NextResponse.redirect(session.url, 303)
}
