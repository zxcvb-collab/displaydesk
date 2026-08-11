import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireOrgContext } from '@/lib/api'

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const supabase = await createClient()
    const ctx = await requireOrgContext(supabase)
    if ('response' in ctx) return ctx.response

    const { error } = await supabase
        .from('design_templates')
        .delete()
        .eq('id', id)
        .eq('org_id', ctx.orgId)

    if (error) {
        console.error('Failed to delete design template:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
}
