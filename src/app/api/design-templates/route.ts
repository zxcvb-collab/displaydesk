import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveOrgId } from '@/lib/org'

export async function GET() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const resolved = await resolveOrgId(supabase, user.id)
    if (!resolved) return NextResponse.json({ error: 'No organisation found' }, { status: 404 })

    const { data, error } = await supabase
        .from('design_templates')
        .select('id, name, design, created_at')
        .eq('org_id', resolved.orgId)
        .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ templates: data ?? [] })
}

export async function POST(request: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const resolved = await resolveOrgId(supabase, user.id)
    if (!resolved) return NextResponse.json({ error: 'No organisation found' }, { status: 404 })

    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const design = body.design
    if (!name || !design) {
        return NextResponse.json({ error: 'name and design are required' }, { status: 400 })
    }

    const { data, error } = await supabase
        .from('design_templates')
        .insert({ org_id: resolved.orgId, name, design })
        .select('id, name, design, created_at')
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ template: data })
}
