import { NextResponse } from 'next/server'
import { jsonError, requireOrg } from '@/lib/api/server'

export async function GET() {
    const auth = await requireOrg()
    if (!auth.ok) return auth.response
    const { supabase, orgId } = auth.value

    const { data, error } = await supabase
        .from('design_templates')
        .select('id, name, design, created_at')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })

    if (error) return jsonError(error.message, 500)
    return NextResponse.json({ templates: data ?? [] })
}

export async function POST(request: Request) {
    const auth = await requireOrg()
    if (!auth.ok) return auth.response
    const { supabase, orgId } = auth.value

    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const design = body.design
    if (!name || !design) {
        return jsonError('name and design are required', 400)
    }

    const { data, error } = await supabase
        .from('design_templates')
        .insert({ org_id: orgId, name, design })
        .select('id, name, design, created_at')
        .single()

    if (error) return jsonError(error.message, 500)
    return NextResponse.json({ template: data })
}
