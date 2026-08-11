import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { readJsonBody, requireOrgContext } from '@/lib/api'

export async function POST(request: Request) {
    const supabase = await createClient()
    const ctx = await requireOrgContext(supabase)
    if ('response' in ctx) return ctx.response

    if (ctx.role !== 'owner') {
        return NextResponse.json({ error: 'Only the org owner can invite team members' }, { status: 403 })
    }

    const parsed = await readJsonBody(request)
    if ('response' in parsed) return parsed.response

    const email = typeof parsed.body.email === 'string' ? parsed.body.email.trim() : ''
    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

    const { data, error } = await supabase
        .from('org_invites')
        .insert({ org_id: ctx.orgId, email })
        .select('token')
        .single()

    if (error) {
        console.error('Failed to create invite:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const origin = new URL(request.url).origin
    return NextResponse.json({ url: `${origin}/invite/${data.token}` })
}
