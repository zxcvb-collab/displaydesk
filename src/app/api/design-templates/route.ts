import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { readJsonBody, requireOrgContext } from '@/lib/api'

export async function GET() {
    const supabase = await createClient()
    const ctx = await requireOrgContext(supabase)
    if ('response' in ctx) return ctx.response

    const { data, error } = await supabase
        .from('design_templates')
        .select('id, name, design, created_at')
        .eq('org_id', ctx.orgId)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Failed to list design templates:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ templates: data ?? [] })
}

export async function POST(request: Request) {
    const supabase = await createClient()
    const ctx = await requireOrgContext(supabase)
    if ('response' in ctx) return ctx.response

    const parsed = await readJsonBody(request)
    if ('response' in parsed) return parsed.response

    const name = typeof parsed.body.name === 'string' ? parsed.body.name.trim() : ''
    const design = parsed.body.design
    if (!name || !design) {
        return NextResponse.json({ error: 'name and design are required' }, { status: 400 })
    }

    const { data, error } = await supabase
        .from('design_templates')
        .insert({ org_id: ctx.orgId, name, design })
        .select('id, name, design, created_at')
        .single()

    if (error) {
        console.error('Failed to save design template:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ template: data })
}
