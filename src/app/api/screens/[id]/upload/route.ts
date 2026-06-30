import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: org } = await supabase
        .from('organisations')
        .select('id')
        .eq('owner_id', user.id)
        .single()

    if (!org) return NextResponse.json({ error: 'No organisation' }, { status: 401 })

    // Verify screen belongs to this org
    const { data: screen } = await supabase
        .from('screens')
        .select('id')
        .eq('id', id)
        .eq('org_id', org.id)
        .single()

    if (!screen) return NextResponse.json({ error: 'Screen not found' }, { status: 404 })

    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    if (!file.type.startsWith('video/')) {
        return NextResponse.json({ error: 'File must be a video' }, { status: 400 })
    }

    // Generate unique filename
    const ext = file.name.split('.').pop() || 'mp4'
    const filename = `${org.id}/${id}/${Date.now()}.${ext}`

    const { data, error } = await supabase.storage
        .from('videos')
        .upload(filename, file, { upsert: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Get public URL
    const { data: urlData } = supabase.storage
        .from('videos')
        .getPublicUrl(data.path)

    return NextResponse.json({ url: urlData.publicUrl })
}
