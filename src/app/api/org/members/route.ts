import { NextResponse } from 'next/server'
import { jsonError, requireOrg } from '@/lib/api/server'

export async function DELETE(request: Request) {
    const auth = await requireOrg({ ownerOnly: 'Only the org owner can remove team members' })
    if (!auth.ok) return auth.response
    const { supabase, orgId } = auth.value

    const memberUserId = new URL(request.url).searchParams.get('userId')
    if (!memberUserId) return jsonError('userId is required', 400)

    const { error } = await supabase
        .from('org_members')
        .delete()
        .eq('org_id', orgId)
        .eq('user_id', memberUserId)

    if (error) return jsonError(error.message, 500)
    return NextResponse.json({ success: true })
}
