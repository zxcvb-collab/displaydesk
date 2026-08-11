import { NextResponse } from 'next/server'
import { jsonError, requireOrg } from '@/lib/api/server'

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const auth = await requireOrg()
    if (!auth.ok) return auth.response
    const { supabase, orgId } = auth.value

    const { error } = await supabase
        .from('design_templates')
        .delete()
        .eq('id', id)
        .eq('org_id', orgId)

    if (error) return jsonError(error.message, 500)
    return NextResponse.json({ ok: true })
}
