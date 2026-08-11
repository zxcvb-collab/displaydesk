import { NextResponse } from 'next/server'
import { jsonError, requireUser } from '@/lib/api/server'

export async function PATCH(request: Request) {
    const auth = await requireUser()
    if (!auth.ok) return auth.response
    const { supabase, user } = auth.value

    const body = await request.json()
    const updates: Record<string, unknown> = {}
    if (body.default_schedule !== undefined) updates.default_schedule = body.default_schedule

    const { data, error } = await supabase
        .from('organisations')
        .update(updates)
        .eq('owner_id', user.id)
        .select()
        .single()

    if (error) return jsonError(error.message, 500)
    return NextResponse.json(data)
}
