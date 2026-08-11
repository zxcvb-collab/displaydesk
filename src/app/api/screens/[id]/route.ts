import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isPaidPlan, syncScreenAddon } from '@/lib/stripe'
import { readJsonBody, requireOrgContext } from '@/lib/api'

type Org = { id: string; status: string; plan: string; stripe_subscription_id: string | null }

// Disabled orgs are rejected here too — the dashboard blocks access at the
// UI level, but mutating routes need their own check since RLS is scoped to
// ownership, not lifecycle status. Owners and members both get full
// screen-management access. A failed lookup is reported as such rather than
// masquerading as "unauthorized".
async function getOrgForUser(
    supabase: Awaited<ReturnType<typeof createClient>>
): Promise<{ org: Org } | { response: NextResponse }> {
    const ctx = await requireOrgContext(supabase)
    if ('response' in ctx) return ctx

    const { data: org, error } = await supabase
        .from('organisations')
        .select('id, status, plan, stripe_subscription_id')
        .eq('id', ctx.orgId)
        .single()

    if (error) {
        console.error('Failed to load organisation:', error)
        return { response: NextResponse.json({ error: 'Could not load your organisation' }, { status: 503 }) }
    }
    if (!org) return { response: NextResponse.json({ error: 'No organisation found' }, { status: 404 }) }
    if (org.status === 'disabled') {
        return { response: NextResponse.json({ error: 'This account is paused — upgrade to make changes' }, { status: 403 }) }
    }
    return { org }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const supabase = await createClient()
    const result = await getOrgForUser(supabase)
    if ('response' in result) return result.response
    const { org } = result

    const parsed = await readJsonBody(request)
    if ('response' in parsed) return parsed.response
    const body = parsed.body

    const updates: Record<string, unknown> = {}
    if (body.name !== undefined) updates.name = body.name
    if (body.slides !== undefined) updates.slides = body.slides
    if (body.schedule_mode !== undefined) updates.schedule_mode = body.schedule_mode
    if (body.schedule !== undefined) updates.schedule = body.schedule

    if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'No supported fields to update' }, { status: 400 })
    }

    const { data, error } = await supabase
        .from('screens')
        .update(updates)
        .eq('id', id)
        .eq('org_id', org.id)
        .select()
        .single()

    if (error) {
        console.error('Failed to update screen:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const supabase = await createClient()
    const result = await getOrgForUser(supabase)
    if ('response' in result) return result.response
    const { org } = result

    const { error } = await supabase
        .from('screens')
        .delete()
        .eq('id', id)
        .eq('org_id', org.id)

    if (error) {
        console.error('Failed to delete screen:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (isPaidPlan(org.plan) && org.stripe_subscription_id) {
        try {
            const { count, error: countError } = await supabase
                .from('screens')
                .select('*', { count: 'exact', head: true })
                .eq('org_id', org.id)
            if (countError) throw new Error(countError.message)
            await syncScreenAddon(org.stripe_subscription_id, org.plan, count ?? 0)
        } catch (err) {
            // The screen is already gone — billing is reconciled on the
            // next add/remove or plan change, so don't fail the request
            console.error('Failed to sync screen add-on billing:', err)
        }
    }

    return NextResponse.json({ success: true })
}
