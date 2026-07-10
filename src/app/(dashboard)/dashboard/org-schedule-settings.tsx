'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import WeekScheduleEditor from '@/components/week-schedule-editor'
import { emptySchedule, type WeekSchedule } from '@/lib/schedule'

export default function OrgScheduleSettings({ initialSchedule }: { initialSchedule: WeekSchedule | null }) {
    const [enabled, setEnabled] = useState(initialSchedule !== null)
    const [schedule, setSchedule] = useState<WeekSchedule>(initialSchedule ?? emptySchedule())
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)

    async function save() {
        setSaving(true)
        setSaved(false)
        try {
            await fetch('/api/organisation', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ default_schedule: enabled ? schedule : null }),
            })
            setSaved(true)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="mt-10">
            <div className="flex items-center justify-between mb-1">
                <h2 className="font-semibold text-zinc-900">Business Hours</h2>
            </div>
            <p className="text-sm text-zinc-500 mb-4">
                Default schedule for screens set to &ldquo;Use business hours.&rdquo; Outside these hours, the TV shows a black screen instead of playing content.
            </p>

            <label className="flex items-center gap-2 text-sm mb-4">
                <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="rounded border-zinc-300"
                />
                Restrict playback to business hours
            </label>

            {enabled && (
                <div className="bg-white border border-zinc-200 rounded-2xl p-4 mb-4">
                    <WeekScheduleEditor value={schedule} onChange={setSchedule} />
                </div>
            )}

            <div className="flex items-center gap-3">
                <Button onClick={save} disabled={saving} size="sm">
                    {saving ? 'Saving…' : 'Save business hours'}
                </Button>
                {saved && <span className="text-xs text-zinc-400">Saved</span>}
            </div>
        </div>
    )
}
