import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isPaidPlan, syncScreenAddon } from '@/lib/stripe'
import { resolveOrgId } from '@/lib/org'
import { readJsonBody, validateName, validateSchedule, validateScheduleMode, validateSlides } from '@/lib/validation'
import { isSameOrigin } from '@/lib/security'

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
    if (!isSameOrigin(request)) {
        return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
    }

    const { id } = await params
    const supabase = await createClient()
    const org = await getOrgForUser(supabase)
    if (!org) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await readJsonBody(request)
    if (!body.ok) return NextResponse.json({ error: body.error }, { status: 400 })

    const updates: Record<string, unknown> = {}
    if (body.value.name !== undefined) {
        const name = validateName(body.value.name)
        if (!name.ok) return NextResponse.json({ error: name.error }, { status: 400 })
        updates.name = name.value
    }
    if (body.value.slides !== undefined) {
        const slides = validateSlides(body.value.slides)
        if (!slides.ok) return NextResponse.json({ error: slides.error }, { status: 400 })
        updates.slides = slides.value
    }
    if (body.value.schedule_mode !== undefined) {
        const mode = validateScheduleMode(body.value.schedule_mode)
        if (!mode.ok) return NextResponse.json({ error: mode.error }, { status: 400 })
        updates.schedule_mode = mode.value
    }
    if (body.value.schedule !== undefined) {
        const schedule = validateSchedule(body.value.schedule)
        if (!schedule.ok) return NextResponse.json({ error: schedule.error }, { status: 400 })
        updates.schedule = schedule.value
    }

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
        return NextResponse.json({ error: 'Failed to update screen' }, { status: 500 })
    }
    return NextResponse.json(data)
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    if (!isSameOrigin(request)) {
        return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
    }

    const { id } = await params
    const supabase = await createClient()
    const org = await getOrgForUser(supabase)
    if (!org) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { error } = await supabase
        .from('screens')
        .delete()
        .eq('id', id)
        .eq('org_id', org.id)

    if (error) {
        console.error('Failed to delete screen:', error)
        return NextResponse.json({ error: 'Failed to delete screen' }, { status: 500 })
    }

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
