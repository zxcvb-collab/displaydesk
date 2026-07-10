'use client'

import { DAY_KEYS, DAY_LABELS, type WeekSchedule } from '@/lib/schedule'

export default function WeekScheduleEditor({
    value,
    onChange,
}: {
    value: WeekSchedule
    onChange: (next: WeekSchedule) => void
}) {
    function toggleDay(day: keyof WeekSchedule, open: boolean) {
        onChange({
            ...value,
            [day]: open ? { open: '09:00', close: '17:00' } : null,
        })
    }

    function setTime(day: keyof WeekSchedule, field: 'open' | 'close', time: string) {
        const current = value[day]
        if (!current) return
        onChange({ ...value, [day]: { ...current, [field]: time } })
    }

    return (
        <div className="space-y-2">
            {DAY_KEYS.map((day) => {
                const hours = value[day]
                return (
                    <div key={day} className="flex items-center gap-3">
                        <label className="flex items-center gap-2 w-32 shrink-0 text-sm">
                            <input
                                type="checkbox"
                                checked={hours !== null}
                                onChange={(e) => toggleDay(day, e.target.checked)}
                                className="rounded border-zinc-300"
                            />
                            {DAY_LABELS[day]}
                        </label>
                        {hours ? (
                            <div className="flex items-center gap-2">
                                <input
                                    type="time"
                                    value={hours.open}
                                    onChange={(e) => setTime(day, 'open', e.target.value)}
                                    className="px-2 py-1 border border-zinc-300 rounded-lg text-sm"
                                />
                                <span className="text-zinc-400 text-sm">to</span>
                                <input
                                    type="time"
                                    value={hours.close}
                                    onChange={(e) => setTime(day, 'close', e.target.value)}
                                    className="px-2 py-1 border border-zinc-300 rounded-lg text-sm"
                                />
                            </div>
                        ) : (
                            <span className="text-sm text-zinc-400">Closed</span>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
