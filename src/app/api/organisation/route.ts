import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { readJsonBody, validateSchedule } from '@/lib/validation'
import { isSameOrigin } from '@/lib/security'

export async function PATCH(request: Request) {
    if (!isSameOrigin(request)) {
        return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await readJsonBody(request)
    if (!body.ok) return NextResponse.json({ error: body.error }, { status: 400 })

    const updates: Record<string, unknown> = {}
    if (body.value.default_schedule !== undefined) {
        const schedule = validateSchedule(body.value.default_schedule)
        if (!schedule.ok) return NextResponse.json({ error: schedule.error }, { status: 400 })
        updates.default_schedule = schedule.value
    }

    if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'No supported fields to update' }, { status: 400 })
    }

    const { data, error } = await supabase
        .from('organisations')
        .update(updates)
        .eq('owner_id', user.id)
        .select()
        .single()

    if (error) {
        console.error('Failed to update organisation:', error)
        return NextResponse.json({ error: 'Failed to update organisation' }, { status: 500 })
    }
    return NextResponse.json(data)
}
