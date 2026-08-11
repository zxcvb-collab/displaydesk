import { notFound } from 'next/navigation'
import { requireActiveOrgPage } from '@/lib/org/page'
import { normalizeSlides } from '@/lib/slides'
import type { WeekSchedule } from '@/lib/schedule'
import ScreenEditor from './screen-editor'

export const dynamic = 'force-dynamic'

export default async function ScreenPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const { supabase, org } = await requireActiveOrgPage<{
        id: string
        status: string
        default_schedule: WeekSchedule | null
    }>('id, status, default_schedule')

    const { data: screen } = await supabase
        .from('screens')
        .select('id, name, pin, slides, schedule_mode, schedule')
        .eq('id', id)
        .eq('org_id', org.id)
        .single()

    if (!screen) notFound()

    return (
        <ScreenEditor
            orgId={org.id}
            orgDefaultSchedule={org.default_schedule ?? null}
            screen={{
                ...screen,
                slides: normalizeSlides(screen.slides),
            }}
        />
    )
}
