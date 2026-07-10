import { NextResponse } from 'next/server'
import { createAnonClient } from '@/lib/supabase/anon'

export async function GET(request: Request, { params }: { params: Promise<{ pin: string }> }) {
    const { pin } = await params
    const supabase = createAnonClient()

    const { data: screens, error } = await supabase.rpc('get_screen_by_pin', { p_pin: pin })
    const screen = screens?.[0]

    if (error || !screen) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const searchParams = new URL(request.url).searchParams
    const slideParam = searchParams.get('slide')
    const slideIndex = slideParam !== null ? Number(slideParam) : null
    const openParam = searchParams.get('open')
    await supabase.rpc('report_screen_heartbeat', {
        p_pin: pin,
        p_slide_index: Number.isInteger(slideIndex) ? slideIndex : null,
        p_is_open: openParam !== null ? openParam === 'true' : null,
    })

    return NextResponse.json({
        slides: Array.isArray(screen.slides) ? screen.slides : [],
        scheduleMode: screen.schedule_mode,
        schedule: screen.schedule,
        orgDefaultSchedule: screen.org_default_schedule,
    })
}
