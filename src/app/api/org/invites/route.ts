import { NextResponse } from 'next/server'
import { jsonError, requireOrg } from '@/lib/api/server'

export async function POST(request: Request) {
    const auth = await requireOrg({ ownerOnly: 'Only the org owner can invite team members' })
    if (!auth.ok) return auth.response
    const { supabase, orgId } = auth.value

    const body = await request.json()
    const email = (body.email as string | undefined)?.trim()
    if (!email) return jsonError('Email is required', 400)

    const { data, error } = await supabase
        .from('org_invites')
        .insert({ org_id: orgId, email })
        .select('token')
        .single()

    if (error) return jsonError(error.message, 500)

    const origin = new URL(request.url).origin
    return NextResponse.json({ url: `${origin}/invite/${data.token}` })
}
