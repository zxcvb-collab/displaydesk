import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { readJsonBody } from '@/lib/validation'
import { isSameOrigin } from '@/lib/security'

export async function POST(request: Request) {
    if (!isSameOrigin(request)) {
        return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await readJsonBody(request)
    if (!body.ok) return NextResponse.json({ error: body.error }, { status: 400 })
    const token = typeof body.value.token === 'string' ? body.value.token : ''
    if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 400 })

    // Uses the admin client since RLS intentionally only lets the org
    // owner INSERT into org_members directly - redemption needs to let
    // the invitee add themselves, which is exactly what this endpoint's
    // own validation (unexpired, unused, existing invite) exists to gate
    const admin = createAdminClient()

    const { data: invite, error: inviteError } = await admin
        .from('org_invites')
        .select('id, org_id, email, expires_at, used_at')
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
    // The invite is issued to one specific address, so a leaked link alone
    // can't be used by whoever happens to find it
    if (invite.email?.trim().toLowerCase() !== user.email?.trim().toLowerCase()) {
        return NextResponse.json(
            { error: 'This invite was sent to a different email address' },
            { status: 403 }
        )
    }

    const { error: memberError } = await admin
        .from('org_members')
        .insert({ org_id: invite.org_id, user_id: user.id })

    if (memberError && memberError.code !== '23505') {
        // 23505 = already a member (unique violation) - treat as success
        console.error('Failed to add org member on invite redemption:', memberError)
        return NextResponse.json({ error: 'Could not join this team' }, { status: 500 })
    }

    await admin.from('org_invites').update({ used_at: new Date().toISOString() }).eq('id', invite.id)

    return NextResponse.json({ success: true })
}
