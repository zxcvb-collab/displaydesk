import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveOrgId } from '@/lib/org'
import { readJsonBody, validateDesign, validateName } from '@/lib/validation'
import { isSameOrigin } from '@/lib/security'

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

    if (error) {
        console.error('Failed to list design templates:', error)
        return NextResponse.json({ error: 'Failed to load design templates' }, { status: 500 })
    }
    return NextResponse.json({ templates: data ?? [] })
}

export async function POST(request: Request) {
    if (!isSameOrigin(request)) {
        return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const resolved = await resolveOrgId(supabase, user.id)
    if (!resolved) return NextResponse.json({ error: 'No organisation found' }, { status: 404 })

    const body = await readJsonBody(request)
    if (!body.ok) return NextResponse.json({ error: body.error }, { status: 400 })

    const name = validateName(typeof body.value.name === 'string' ? body.value.name.trim() : body.value.name)
    if (!name.ok) return NextResponse.json({ error: name.error }, { status: 400 })
    if (!name.value) return NextResponse.json({ error: 'name is required' }, { status: 400 })

    const design = validateDesign(body.value.design)
    if (!design.ok) return NextResponse.json({ error: design.error }, { status: 400 })

    const { data, error } = await supabase
        .from('design_templates')
        .insert({ org_id: resolved.orgId, name: name.value, design: design.value })
        .select('id, name, design, created_at')
        .single()

    if (error) {
        console.error('Failed to save design template:', error)
        return NextResponse.json({ error: 'Failed to save design template' }, { status: 500 })
    }
    return NextResponse.json({ template: data })
}
