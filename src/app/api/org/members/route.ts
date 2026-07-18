import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveOrgId } from '@/lib/org'

export async function DELETE(request: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const resolved = await resolveOrgId(supabase, user.id)
    if (!resolved || resolved.role !== 'owner') {
        return NextResponse.json({ error: 'Only the org owner can remove team members' }, { status: 403 })
    }

    const memberUserId = new URL(request.url).searchParams.get('userId')
    if (!memberUserId) return NextResponse.json({ error: 'userId is required' }, { status: 400 })

    const { error } = await supabase
        .from('org_members')
        .delete()
        .eq('org_id', resolved.orgId)
        .eq('user_id', memberUserId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}
