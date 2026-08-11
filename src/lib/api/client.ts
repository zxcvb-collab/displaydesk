import type { Slide } from '@/lib/slides'
import type { ScheduleMode, WeekSchedule } from '@/lib/schedule'
import type { DesignData } from '@/lib/design'

/** JSON fetch for this app's own API routes — sets the method and JSON headers/body. */
export function apiFetch(path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown): Promise<Response> {
    return fetch(path, {
        method,
        ...(body === undefined
            ? {}
            : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    })
}

export type ScreenUpdates = {
    name?: string
    slides?: Slide[]
    schedule_mode?: ScheduleMode
    schedule?: WeekSchedule | null
}

export async function patchScreen(id: string, updates: ScreenUpdates) {
    const res = await apiFetch(`/api/screens/${id}`, 'PATCH', updates)
    if (!res.ok) throw new Error('Failed to save')
}

export type SavedTemplate = { id: string; name: string; design: DesignData }

export async function fetchDesignTemplates(): Promise<SavedTemplate[]> {
    const res = await fetch('/api/design-templates')
    if (!res.ok) return []
    const body = await res.json()
    return body.templates ?? []
}

export async function createDesignTemplate(name: string, design: DesignData): Promise<SavedTemplate | null> {
    const res = await apiFetch('/api/design-templates', 'POST', { name, design })
    if (!res.ok) return null
    const body = await res.json()
    return body.template ?? null
}
