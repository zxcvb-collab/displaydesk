import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireOrgContext } from '@/lib/api'

export async function DELETE(request: Request) {
    const supabase = await createClient()
    const ctx = await requireOrgContext(supabase)
    if ('response' in ctx) return ctx.response

    if (ctx.role !== 'owner') {
        return NextResponse.json({ error: 'Only the org owner can remove team members' }, { status: 403 })
    }

    const memberUserId = new URL(request.url).searchParams.get('userId')
    if (!memberUserId) return NextResponse.json({ error: 'userId is required' }, { status: 400 })

    const { error } = await supabase
        .from('org_members')
        .delete()
        .eq('org_id', ctx.orgId)
        .eq('user_id', memberUserId)

    if (error) {
        console.error('Failed to remove team member:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
}
