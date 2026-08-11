import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveOrgId } from '@/lib/org'
import { isValidEmail, readJsonBody } from '@/lib/validation'
import { isSameOrigin } from '@/lib/security'

export async function POST(request: Request) {
    if (!isSameOrigin(request)) {
        return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const resolved = await resolveOrgId(supabase, user.id)
    if (!resolved || resolved.role !== 'owner') {
        return NextResponse.json({ error: 'Only the org owner can invite team members' }, { status: 403 })
    }

    const body = await readJsonBody(request)
    if (!body.ok) return NextResponse.json({ error: body.error }, { status: 400 })

    const email = typeof body.value.email === 'string' ? body.value.email.trim().toLowerCase() : ''
    if (!isValidEmail(email)) {
        return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 })
    }

    const { data, error } = await supabase
        .from('org_invites')
        .insert({ org_id: resolved.orgId, email })
        .select('token')
        .single()

    if (error) {
        console.error('Failed to create org invite:', error)
        return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 })
    }

    const origin = new URL(request.url).origin
    return NextResponse.json({ url: `${origin}/invite/${data.token}` })
}
