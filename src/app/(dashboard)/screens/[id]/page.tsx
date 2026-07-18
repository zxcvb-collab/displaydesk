import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveOrgId } from '@/lib/org'
import { emptyDesign, type DesignData } from '@/lib/design'
import ScreenEditor from './screen-editor'

type Slide = {
    url?: string
    type: 'youtube' | 'video' | 'design'
    design?: DesignData
    duration?: number
    name?: string
}

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

    const slides: Slide[] = Array.isArray(screen.slides)
        ? screen.slides.map((slide: unknown) => {
            if (typeof slide === 'string') {
                return { url: slide, type: 'youtube' as const }
            }
            if (typeof slide === 'object' && slide !== null && 'type' in slide) {
                const s = slide as Slide
                if (s.type === 'design') {
                    return { type: 'design' as const, design: s.design ?? emptyDesign(), duration: s.duration, name: s.name }
                }
                if ('url' in s) {
                    return s
                }
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
