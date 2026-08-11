import { NextResponse } from 'next/server'
import { jsonError, requireOrgRecord } from '@/lib/api/server'
import { syncScreenAddonForOrg } from '@/lib/stripe'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const auth = await requireOrgRecord()
    if (!auth.ok) return auth.response
    const { supabase, org } = auth.value

    const body = await request.json()
    const updates: Record<string, unknown> = {}
    if (body.name !== undefined) updates.name = body.name
    if (body.slides !== undefined) updates.slides = body.slides
    if (body.schedule_mode !== undefined) updates.schedule_mode = body.schedule_mode
    if (body.schedule !== undefined) updates.schedule = body.schedule

    const { data, error } = await supabase
        .from('screens')
        .update(updates)
        .eq('id', id)
        .eq('org_id', org.id)
        .select()
        .single()

    if (error) return jsonError(error.message, 500)
    return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const auth = await requireOrgRecord()
    if (!auth.ok) return auth.response
    const { supabase, org } = auth.value

    const { error } = await supabase
        .from('screens')
        .delete()
        .eq('id', id)
        .eq('org_id', org.id)

    if (error) return jsonError(error.message, 500)

    await syncScreenAddonForOrg(supabase, org.id, org.plan, org.stripe_subscription_id)

    return NextResponse.json({ success: true })
}
