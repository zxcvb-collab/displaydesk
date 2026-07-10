export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export const DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export const DAY_LABELS: Record<DayKey, string> = {
    mon: 'Monday',
    tue: 'Tuesday',
    wed: 'Wednesday',
    thu: 'Thursday',
    fri: 'Friday',
    sat: 'Saturday',
    sun: 'Sunday',
}

export type DayHours = { open: string; close: string } | null

export type WeekSchedule = Record<DayKey, DayHours>

export type ScheduleMode = 'inherit' | 'custom' | 'always_on'

const JS_DAY_TO_KEY: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

/**
 * Resolves which schedule actually governs a screen's playback, given its
 * own mode/schedule and the org's default. Returns null when there is no
 * effective schedule (i.e. always on).
 */
export function resolveEffectiveSchedule(
    mode: ScheduleMode,
    screenSchedule: WeekSchedule | null,
    orgDefaultSchedule: WeekSchedule | null
): WeekSchedule | null {
    if (mode === 'always_on') return null
    if (mode === 'custom') return screenSchedule
    return orgDefaultSchedule
}

/**
 * Evaluates whether "now" (client-local time) falls within the open
 * window for today, given an effective schedule. A null schedule, or a
 * missing/null entry for today, means always open (no restriction).
 */
export function isOpenNow(schedule: WeekSchedule | null, now: Date = new Date()): boolean {
    if (!schedule) return true

    const dayKey = JS_DAY_TO_KEY[now.getDay()]
    const hours = schedule[dayKey]
    if (!hours) return true

    const nowMinutes = now.getHours() * 60 + now.getMinutes()
    const [openH, openM] = hours.open.split(':').map(Number)
    const [closeH, closeM] = hours.close.split(':').map(Number)
    const openMinutes = openH * 60 + openM
    const closeMinutes = closeH * 60 + closeM

    // Overnight windows (e.g. open 18:00, close 02:00) wrap past midnight
    if (closeMinutes <= openMinutes) {
        return nowMinutes >= openMinutes || nowMinutes < closeMinutes
    }
    return nowMinutes >= openMinutes && nowMinutes < closeMinutes
}

export function emptySchedule(): WeekSchedule {
    return { mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null }
}
