import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getOrgForUser(supabase: Awaited<ReturnType<typeof createClient>>) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: org } = await supabase
        .from('organisations')
        .select('id')
        .eq('owner_id', user.id)
        .single()
    return org
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const supabase = await createClient()
    const org = await getOrgForUser(supabase)
    if (!org) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const supabase = await createClient()
    const org = await getOrgForUser(supabase)
    if (!org) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { error } = await supabase
        .from('screens')
        .delete()
        .eq('id', id)
        .eq('org_id', org.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}
