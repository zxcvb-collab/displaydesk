import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isPaidPlan, syncScreenAddon } from '@/lib/stripe'
import { resolveOrgId } from '@/lib/org'

// Returns null (treated as unauthorized) for disabled orgs too — the
// dashboard blocks access at the UI level, but mutating routes need their
// own check since RLS is scoped to ownership, not lifecycle status. Owners
// and members both get full screen-management access.
async function getOrgForUser(supabase: Awaited<ReturnType<typeof createClient>>) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const resolved = await resolveOrgId(supabase, user.id)
    if (!resolved) return null
    const { data: org } = await supabase
        .from('organisations')
        .select('id, status, plan, stripe_subscription_id')
        .eq('id', resolved.orgId)
        .single()
    if (!org || org.status === 'disabled') return null
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

    if (isPaidPlan(org.plan) && org.stripe_subscription_id) {
        try {
            const { count } = await supabase
                .from('screens')
                .select('*', { count: 'exact', head: true })
                .eq('org_id', org.id)
            await syncScreenAddon(org.stripe_subscription_id, org.plan, count ?? 0)
        } catch (err) {
            console.error('Failed to sync screen add-on billing:', err)
        }
    }

    return NextResponse.json({ success: true })
}
