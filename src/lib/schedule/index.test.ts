import { describe, expect, it } from 'vitest'
import {
    DAY_KEYS,
    DAY_LABELS,
    emptySchedule,
    isOpenNow,
    resolveEffectiveSchedule,
    type WeekSchedule,
} from './index'

function scheduleWith(overrides: Partial<WeekSchedule>): WeekSchedule {
    return { ...emptySchedule(), ...overrides }
}

// 2026-08-10 is a Monday, so day-of-week arithmetic below is anchored there.
function monday(time: string): Date {
    return new Date(`2026-08-10T${time}:00`)
}

describe('emptySchedule', () => {
    it('returns a null entry for every day key', () => {
        const schedule = emptySchedule()
        expect(Object.keys(schedule)).toEqual(DAY_KEYS)
        expect(Object.values(schedule).every((day) => day === null)).toBe(true)
    })

    it('returns a fresh object each call', () => {
        const first = emptySchedule()
        first.mon = { open: '09:00', close: '17:00' }
        expect(emptySchedule().mon).toBeNull()
    })
})

describe('day metadata', () => {
    it('labels every day key, starting the week on Monday', () => {
        expect(DAY_KEYS.map((key) => DAY_LABELS[key])).toEqual([
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
            'Sunday',
        ])
    })
})

describe('resolveEffectiveSchedule', () => {
    const screen = scheduleWith({ mon: { open: '08:00', close: '12:00' } })
    const orgDefault = scheduleWith({ mon: { open: '10:00', close: '20:00' } })

    it('returns null for always_on regardless of the schedules given', () => {
        expect(resolveEffectiveSchedule('always_on', screen, orgDefault)).toBeNull()
    })

    it('returns the screen schedule for custom mode', () => {
        expect(resolveEffectiveSchedule('custom', screen, orgDefault)).toBe(screen)
    })

    it('returns the screen schedule for custom mode even when it is null', () => {
        expect(resolveEffectiveSchedule('custom', null, orgDefault)).toBeNull()
    })

    it('falls back to the org default for inherit mode', () => {
        expect(resolveEffectiveSchedule('inherit', screen, orgDefault)).toBe(orgDefault)
        expect(resolveEffectiveSchedule('inherit', screen, null)).toBeNull()
    })
})

describe('isOpenNow', () => {
    it('treats a null schedule as always open', () => {
        expect(isOpenNow(null, monday('03:00'))).toBe(true)
    })

    it('treats a day with no hours as always open', () => {
        expect(isOpenNow(emptySchedule(), monday('03:00'))).toBe(true)
    })

    it('is open inside a same-day window and closed outside it', () => {
        const schedule = scheduleWith({ mon: { open: '09:00', close: '17:00' } })
        expect(isOpenNow(schedule, monday('08:59'))).toBe(false)
        expect(isOpenNow(schedule, monday('09:00'))).toBe(true)
        expect(isOpenNow(schedule, monday('12:30'))).toBe(true)
        expect(isOpenNow(schedule, monday('16:59'))).toBe(true)
        expect(isOpenNow(schedule, monday('17:00'))).toBe(false)
    })

    it('wraps past midnight for overnight windows', () => {
        const schedule = scheduleWith({ mon: { open: '18:00', close: '02:00' } })
        expect(isOpenNow(schedule, monday('17:59'))).toBe(false)
        expect(isOpenNow(schedule, monday('18:00'))).toBe(true)
        expect(isOpenNow(schedule, monday('23:59'))).toBe(true)
        // 01:00 Monday belongs to Monday's own overnight window, not Sunday's
        expect(isOpenNow(schedule, monday('01:00'))).toBe(true)
        expect(isOpenNow(schedule, monday('02:00'))).toBe(false)
    })

    // Degenerate window: open === close takes the wrapping branch, where
    // "at or after open" and "before close" together cover the whole day.
    it('treats an open time equal to the close time as open all day', () => {
        const schedule = scheduleWith({ mon: { open: '09:00', close: '09:00' } })
        expect(isOpenNow(schedule, monday('08:59'))).toBe(true)
        expect(isOpenNow(schedule, monday('09:00'))).toBe(true)
        expect(isOpenNow(schedule, monday('12:00'))).toBe(true)
    })

    it('reads hours for the correct weekday', () => {
        const schedule = scheduleWith({
            mon: { open: '09:00', close: '10:00' },
            sun: { open: '20:00', close: '22:00' },
        })
        const sunday = new Date('2026-08-09T21:00:00')
        expect(isOpenNow(schedule, sunday)).toBe(true)
        expect(isOpenNow(schedule, monday('21:00'))).toBe(false)
    })
})
