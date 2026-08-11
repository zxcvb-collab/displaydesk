import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { readJsonBody } from '@/lib/api'
import { NO_ROWS, UNIQUE_VIOLATION } from '@/lib/supabase/errors'

export async function POST(request: Request) {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError) {
        console.error('Auth lookup failed:', authError)
        return NextResponse.json({ error: 'Could not verify your session' }, { status: 503 })
    }
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const parsed = await readJsonBody(request)
    if ('response' in parsed) return parsed.response

    const token = typeof parsed.body.token === 'string' ? parsed.body.token : ''
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

    if (inviteError && inviteError.code !== NO_ROWS) {
        console.error('Failed to look up invite:', inviteError)
        return NextResponse.json({ error: 'Could not check this invite — try again' }, { status: 503 })
    }
    if (!invite) {
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

    if (memberError && memberError.code !== UNIQUE_VIOLATION) {
        // A unique violation means they're already a member - treat as success
        console.error('Failed to add invited member to org:', memberError)
        return NextResponse.json({ error: memberError.message }, { status: 500 })
    }

    // Membership is already granted, so a failure here doesn't break the
    // invitee - but it leaves a single-use invite reusable, so it must not
    // pass unnoticed
    const { error: consumeError } = await admin
        .from('org_invites')
        .update({ used_at: new Date().toISOString() })
        .eq('id', invite.id)
    if (consumeError) {
        console.error('Failed to mark invite as used - it stays redeemable:', consumeError)
    }

    return NextResponse.json({ success: true })
}
