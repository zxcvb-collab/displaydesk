import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveOrgId } from '@/lib/org'
import { isSameOrigin } from '@/lib/security'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function DELETE(request: Request) {
    if (!isSameOrigin(request)) {
        return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const resolved = await resolveOrgId(supabase, user.id)
    if (!resolved || resolved.role !== 'owner') {
        return NextResponse.json({ error: 'Only the org owner can remove team members' }, { status: 403 })
    }

    const memberUserId = new URL(request.url).searchParams.get('userId') ?? ''
    if (!UUID_PATTERN.test(memberUserId)) {
        return NextResponse.json({ error: 'A valid userId is required' }, { status: 400 })
    }

    const { error } = await supabase
        .from('org_members')
        .delete()
        .eq('org_id', resolved.orgId)
        .eq('user_id', memberUserId)

    if (error) {
        console.error('Failed to remove org member:', error)
        return NextResponse.json({ error: 'Failed to remove team member' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
}
