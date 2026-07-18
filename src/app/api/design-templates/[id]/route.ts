import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveOrgId } from '@/lib/org'

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
}
