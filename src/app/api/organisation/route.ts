import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { readJsonBody } from '@/lib/api'
import { NO_ROWS } from '@/lib/supabase/errors'

export async function PATCH(request: Request) {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError) {
        console.error('Auth lookup failed:', authError)
        return NextResponse.json({ error: 'Could not verify your session' }, { status: 503 })
    }
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const parsed = await readJsonBody(request)
    if ('response' in parsed) return parsed.response

    const updates: Record<string, unknown> = {}
    if (parsed.body.default_schedule !== undefined) updates.default_schedule = parsed.body.default_schedule

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
        // Only the owner's own org is updatable, so no matching row means
        // the caller doesn't own one — a 403, not an opaque 500
        if (error.code === NO_ROWS) {
            return NextResponse.json({ error: 'Only the org owner can change business hours' }, { status: 403 })
        }
        console.error('Failed to update organisation:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data)
}
