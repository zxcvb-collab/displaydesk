import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveOrgId } from '@/lib/org'
import ScreenEditor from './screen-editor'

export const dynamic = 'force-dynamic'

export default async function ScreenPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const resolved = await resolveOrgId(supabase, user.id)
    if (!resolved) redirect('/login')

    const { data: org } = await supabase
        .from('organisations')
        .select('id, default_schedule, status')
        .eq('id', resolved.orgId)
        .single()

    if (!org) redirect('/login')
    if (org.status === 'disabled') redirect('/dashboard')

    const { data: screen } = await supabase
        .from('screens')
        .select('id, name, pin, slides, schedule_mode, schedule')
        .eq('id', id)
        .eq('org_id', org.id)
        .single()

    if (!screen) notFound()

    const slides = Array.isArray(screen.slides)
        ? screen.slides.map((slide: unknown) => {
            if (typeof slide === 'object' && slide !== null && 'url' in slide && 'type' in slide) {
                return slide as { url: string; type: 'youtube' | 'video'; offlineThumb?: number }
            }
            if (typeof slide === 'string') {
                return { url: slide, type: 'youtube' as const }
            }
            return { url: '', type: 'youtube' as const }
        })
        : []

    return (
        <ScreenEditor
            orgId={org.id}
            orgDefaultSchedule={org.default_schedule ?? null}
            screen={{
                ...screen,
                slides,
            }}
        />
    )
}
