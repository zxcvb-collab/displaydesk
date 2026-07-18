import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveOrgId } from '@/lib/org'

export async function POST(request: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const resolved = await resolveOrgId(supabase, user.id)
    if (!resolved || resolved.role !== 'owner') {
        return NextResponse.json({ error: 'Only the org owner can invite team members' }, { status: 403 })
    }

    const body = await request.json()
    const email = (body.email as string | undefined)?.trim()
    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

    const { data, error } = await supabase
        .from('org_invites')
        .insert({ org_id: resolved.orgId, email })
        .select('token')
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const origin = new URL(request.url).origin
    return NextResponse.json({ url: `${origin}/invite/${data.token}` })
}
