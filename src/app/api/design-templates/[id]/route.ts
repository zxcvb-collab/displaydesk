import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveOrgId } from '@/lib/org'
import { isSameOrigin } from '@/lib/security'

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    if (!isSameOrigin(request)) {
        return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
    }

    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const resolved = await resolveOrgId(supabase, user.id)
    if (!resolved) return NextResponse.json({ error: 'No organisation found' }, { status: 404 })

    const { error } = await supabase
        .from('design_templates')
        .delete()
        .eq('id', id)
        .eq('org_id', resolved.orgId)

    if (error) {
        console.error('Failed to delete design template:', error)
        return NextResponse.json({ error: 'Failed to delete design template' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
}
