import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { jsonError, requireUser } from '@/lib/api/server'

export async function POST(request: Request) {
    const auth = await requireUser()
    if (!auth.ok) return auth.response
    const { user } = auth.value

    const body = await request.json()
    const token = body.token as string | undefined
    if (!token) return jsonError('Token is required', 400)

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
        return jsonError('Invite not found', 404)
    }
    if (invite.used_at) {
        return jsonError('This invite has already been used', 410)
    }
    if (new Date(invite.expires_at) < new Date()) {
        return jsonError('This invite has expired', 410)
    }

    const { error: memberError } = await admin
        .from('org_members')
        .insert({ org_id: invite.org_id, user_id: user.id })

    if (memberError && memberError.code !== '23505') {
        // 23505 = already a member (unique violation) - treat as success
        return jsonError(memberError.message, 500)
    }

    await admin.from('org_invites').update({ used_at: new Date().toISOString() }).eq('id', invite.id)

    return NextResponse.json({ success: true })
}
