// Server-side validation for the JSON blobs clients POST/PATCH into
// jsonb columns (slides, schedules, designs). RLS scopes *who* can write
// a row, but says nothing about *what* goes in it — without these checks
// any authenticated user can store arbitrary, unbounded JSON that the TV
// player later renders, and media URLs land straight in <img src> /
// CSS url() on every screen showing that slide.

import { DAY_KEYS, type WeekSchedule, type ScheduleMode } from '@/lib/schedule'

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string }

export const MAX_NAME_LENGTH = 200
export const MAX_SLIDES = 100
export const MAX_URL_LENGTH = 2048
export const MAX_JSON_BYTES = 512 * 1024
export const SCHEDULE_MODES: ScheduleMode[] = ['inherit', 'custom', 'always_on']

const SLIDE_TYPES = ['youtube', 'video', 'design'] as const
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function jsonByteSize(value: unknown): number {
    return Buffer.byteLength(JSON.stringify(value ?? null), 'utf8')
}

// Design backgrounds are interpolated into an unquoted CSS url(), so these
// characters have to be excluded to keep a URL from terminating the
// declaration and injecting further CSS.
const CSS_UNSAFE_URL_CHARS = /["'()\\;\s]/

/** Only absolute http(s) URLs — rejects javascript:, data:, and blob: URLs. */
export function isSafeMediaUrl(value: unknown): value is string {
    if (typeof value !== 'string' || value.length > MAX_URL_LENGTH) return false
    if (CSS_UNSAFE_URL_CHARS.test(value)) return false
    try {
        const parsed = new URL(value)
        return parsed.protocol === 'http:' || parsed.protocol === 'https:'
    } catch {
        return false
    }
}

export function validateName(value: unknown): Validated<string> {
    if (typeof value !== 'string') return { ok: false, error: 'name must be a string' }
    if (value.length > MAX_NAME_LENGTH) {
        return { ok: false, error: `name must be at most ${MAX_NAME_LENGTH} characters` }
    }
    return { ok: true, value }
}

/**
 * Recursively checks every `url`/`urls` value inside a design blob, at any
 * nesting depth, so a hand-crafted design can't smuggle a non-http URL
 * into an element the player renders.
 */
function designUrlsAreSafe(value: unknown, depth = 0): boolean {
    if (depth > 20) return false
    if (Array.isArray(value)) return value.every((item) => designUrlsAreSafe(item, depth + 1))
    if (!isPlainObject(value)) return true

    for (const [key, child] of Object.entries(value)) {
        if (key === 'url' && child !== undefined && child !== null && !isSafeMediaUrl(child)) return false
        if (key === 'urls') {
            if (!Array.isArray(child) || !child.every(isSafeMediaUrl)) return false
            continue
        }
        if (!designUrlsAreSafe(child, depth + 1)) return false
    }
    return true
}

export function validateDesign(value: unknown): Validated<Record<string, unknown>> {
    if (!isPlainObject(value)) return { ok: false, error: 'design must be an object' }
    if (jsonByteSize(value) > MAX_JSON_BYTES) return { ok: false, error: 'design is too large' }
    if (!designUrlsAreSafe(value)) return { ok: false, error: 'design contains an unsupported URL' }
    return { ok: true, value }
}

export function validateSlides(value: unknown): Validated<unknown[]> {
    if (!Array.isArray(value)) return { ok: false, error: 'slides must be an array' }
    if (value.length > MAX_SLIDES) return { ok: false, error: `at most ${MAX_SLIDES} slides are allowed` }
    if (jsonByteSize(value) > MAX_JSON_BYTES) return { ok: false, error: 'slides payload is too large' }

    for (const slide of value) {
        if (!isPlainObject(slide)) return { ok: false, error: 'each slide must be an object' }
        const type = slide.type
        if (typeof type !== 'string' || !(SLIDE_TYPES as readonly string[]).includes(type)) {
            return { ok: false, error: 'each slide needs a valid type' }
        }
        if (type === 'design') {
            const design = validateDesign(slide.design)
            if (!design.ok) return design
        } else if (!isSafeMediaUrl(slide.url)) {
            return { ok: false, error: 'each video slide needs a valid http(s) url' }
        }
        if (slide.duration !== undefined) {
            if (typeof slide.duration !== 'number' || !Number.isFinite(slide.duration) || slide.duration <= 0 || slide.duration > 86400) {
                return { ok: false, error: 'slide duration must be a positive number of seconds' }
            }
        }
        if (slide.name !== undefined) {
            const name = validateName(slide.name)
            if (!name.ok) return { ok: false, error: 'slide name is too long' }
        }
    }
    return { ok: true, value }
}

export function validateSchedule(value: unknown): Validated<WeekSchedule | null> {
    if (value === null) return { ok: true, value: null }
    if (!isPlainObject(value)) return { ok: false, error: 'schedule must be an object or null' }

    for (const [key, hours] of Object.entries(value)) {
        if (!(DAY_KEYS as string[]).includes(key)) return { ok: false, error: `unknown schedule day "${key}"` }
        if (hours === null) continue
        if (!isPlainObject(hours)) return { ok: false, error: `schedule for ${key} must be an object or null` }
        if (typeof hours.open !== 'string' || !TIME_PATTERN.test(hours.open) ||
            typeof hours.close !== 'string' || !TIME_PATTERN.test(hours.close)) {
            return { ok: false, error: `schedule for ${key} needs open/close times as HH:MM` }
        }
    }
    return { ok: true, value: value as WeekSchedule }
}

export function validateScheduleMode(value: unknown): Validated<ScheduleMode> {
    if (typeof value !== 'string' || !(SCHEDULE_MODES as string[]).includes(value)) {
        return { ok: false, error: 'schedule_mode must be inherit, custom, or always_on' }
    }
    return { ok: true, value: value as ScheduleMode }
}

// Deliberately permissive (no TLD/deliverability guessing) — just enough
// to reject values that clearly aren't addresses.
export function isValidEmail(value: unknown): value is string {
    return typeof value === 'string' && value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

/** Screen PINs are exactly 4 digits (see generate_unique_pin). */
export function isValidPin(value: unknown): value is string {
    return typeof value === 'string' && /^\d{4}$/.test(value)
}

/**
 * Guards against parsing an oversized/invalid JSON body before it reaches
 * per-field validation.
 */
export async function readJsonBody(request: Request): Promise<Validated<Record<string, unknown>>> {
    const raw = await request.text()
    if (raw.length > MAX_JSON_BYTES) return { ok: false, error: 'Request body is too large' }
    try {
        const parsed = JSON.parse(raw)
        if (!isPlainObject(parsed)) return { ok: false, error: 'Request body must be a JSON object' }
        return { ok: true, value: parsed }
    } catch {
        return { ok: false, error: 'Request body must be valid JSON' }
    }
}
