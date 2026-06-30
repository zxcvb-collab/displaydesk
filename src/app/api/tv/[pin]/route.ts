import { NextResponse } from 'next/server'
import { createAnonClient } from '@/lib/supabase/anon'

export async function GET(_request: Request, { params }: { params: Promise<{ pin: string }> }) {
    const { pin } = await params
    const supabase = createAnonClient()

    const { data: screen, error } = await supabase
        .from('screens')
        .select('slides')
        .eq('pin', pin)
        .single()

    if (error || !screen) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({
        slides: Array.isArray(screen.slides) ? screen.slides : [],
    })
}
