import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
    const origin = new URL(request.url).origin
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: org } = await supabase
        .from('organisations')
        .select('id, plan, status')
        .eq('owner_id', user.id)
        .single()

    if (!org) return NextResponse.json({ error: 'No organisation found' }, { status: 404 })
    if (org.status === 'disabled') return NextResponse.redirect(new URL('/dashboard', origin), 302)

    // Check plan limit
    const planLimit = org.plan === 'free' ? 1 : org.plan === 'starter' ? 2 : org.plan === 'pro' ? 5 : 15
    const { count } = await supabase
        .from('screens')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', org.id)

    if ((count ?? 0) >= planLimit) {
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

    return NextResponse.redirect(
        new URL(`/screens/${screen.id}`, origin),
        302
    )
}