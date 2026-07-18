import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const token = body.token as string | undefined
    if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 400 })

    // Uses the admin client since RLS intentionally only lets the org
    // owner INSERT into org_members directly - redemption needs to let
    // the invitee add themselves, which is exactly what this endpoint's
    // own validation (unexpired, unused, existing invite) exists to gate
    const admin = createAdminClient()

    const { data: invite, error: inviteError } = await admin
        .from('org_invites')
        .select('id, org_id, expires_at, used_at')
        .eq('token', token)
        .single()

    if (inviteError || !invite) {
        return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    }
    if (invite.used_at) {
        return NextResponse.json({ error: 'This invite has already been used' }, { status: 410 })
    }
    if (new Date(invite.expires_at) < new Date()) {
        return NextResponse.json({ error: 'This invite has expired' }, { status: 410 })
    }

    const { error: memberError } = await admin
        .from('org_members')
        .insert({ org_id: invite.org_id, user_id: user.id })

    if (memberError && memberError.code !== '23505') {
        // 23505 = already a member (unique violation) - treat as success
        return NextResponse.json({ error: memberError.message }, { status: 500 })
    }

    await admin.from('org_invites').update({ used_at: new Date().toISOString() }).eq('id', invite.id)

    return NextResponse.json({ success: true })
}
