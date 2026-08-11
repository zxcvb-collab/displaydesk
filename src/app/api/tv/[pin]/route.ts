import { NextResponse } from 'next/server'
import { createAnonClient } from '@/lib/supabase/anon'

export async function GET(request: Request, { params }: { params: Promise<{ pin: string }> }) {
    const { pin } = await params
    const supabase = createAnonClient()

    const { data: screens, error } = await supabase.rpc('get_screen_by_pin', { p_pin: pin })

    // A lookup failure is not the same as an unknown PIN — the player uses
    // a failed poll as its offline signal, so it must not be told the
    // screen doesn't exist when the backend is simply unreachable
    if (error) {
        console.error(`Failed to look up screen for PIN ${pin}:`, error)
        return NextResponse.json({ error: 'Could not load this screen' }, { status: 503 })
    }

    const screen = screens?.[0]
    if (!screen) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const searchParams = new URL(request.url).searchParams
    const slideParam = searchParams.get('slide')
    const slideIndex = slideParam !== null ? Number(slideParam) : null
    const openParam = searchParams.get('open')
    // Heartbeat is telemetry only — log a failure but still serve content,
    // since playback matters more than dashboard status
    const { error: heartbeatError } = await supabase.rpc('report_screen_heartbeat', {
        p_pin: pin,
        p_slide_index: Number.isInteger(slideIndex) ? slideIndex : null,
        p_is_open: openParam !== null ? openParam === 'true' : null,
    })
    if (heartbeatError) {
        console.error(`Failed to record heartbeat for PIN ${pin}:`, heartbeatError)
    }

    return NextResponse.json({
        slides: Array.isArray(screen.slides) ? screen.slides : [],
        scheduleMode: screen.schedule_mode,
        schedule: screen.schedule,
        orgDefaultSchedule: screen.org_default_schedule,
        orgStatus: screen.org_status,
    })
}
