import { NextResponse } from 'next/server'
import { createAnonClient } from '@/lib/supabase/anon'

export async function GET(_request: Request, { params }: { params: Promise<{ pin: string }> }) {
    const { pin } = await params
    const supabase = createAnonClient()

    const { data: screens, error } = await supabase.rpc('get_screen_by_pin', { p_pin: pin })
    const screen = screens?.[0]

    if (error || !screen) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({
        slides: Array.isArray(screen.slides) ? screen.slides : [],
    })
}
