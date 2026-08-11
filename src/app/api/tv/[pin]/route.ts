import { NextResponse } from 'next/server'
import { createAnonClient } from '@/lib/supabase/anon'
import { isValidPin } from '@/lib/validation'

// PINs are only 4 digits, and this route is unauthenticated by design (a
// TV has no login), so the whole keyspace is walkable in a few thousand
// requests — each hit both discloses a screen's content and overwrites its
// heartbeat/current-slide state. Throttle per client so a single caller
// can't sweep the keyspace at speed. Per-instance and best-effort: it
// resets on cold start, so it raises the cost of enumeration rather than
// making it impossible (a longer PIN, or an edge/WAF rate limit, is the
// real fix).
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS = 60
const hits = new Map<string, { count: number; resetAt: number }>()

function clientKey(request: Request): string {
    const forwarded = request.headers.get('x-forwarded-for')
    return forwarded?.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown'
}

function isRateLimited(request: Request): boolean {
    const key = clientKey(request)
    const now = Date.now()
    const entry = hits.get(key)

    if (!entry || entry.resetAt <= now) {
        hits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
        if (hits.size > 10_000) {
            for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k)
        }
        return false
    }

    entry.count++
    return entry.count > RATE_LIMIT_MAX_REQUESTS
}

export async function GET(request: Request, { params }: { params: Promise<{ pin: string }> }) {
    const { pin } = await params
    if (!isValidPin(pin)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (isRateLimited(request)) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

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
        orgStatus: screen.org_status,
    })
}
