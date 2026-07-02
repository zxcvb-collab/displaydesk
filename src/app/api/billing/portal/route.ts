import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export async function POST(request: Request) {
    const origin = new URL(request.url).origin
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: org } = await supabase
        .from('organisations')
        .select('stripe_customer_id')
        .eq('owner_id', user.id)
        .single()

    if (!org?.stripe_customer_id) {
        return NextResponse.json({ error: 'No billing account found' }, { status: 404 })
    }

    const session = await stripe.billingPortal.sessions.create({
        customer: org.stripe_customer_id,
        return_url: `${origin}/dashboard`,
    })

    return NextResponse.redirect(session.url, 303)
}
