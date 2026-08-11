import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveOrgId } from '@/lib/org'
import { NO_ROWS } from '@/lib/supabase/errors'
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

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError) throw new Error(`Could not verify your session: ${authError.message}`)
    if (!user) redirect('/login')

    const resolved = await resolveOrgId(supabase, user.id)
    if (!resolved) redirect('/login')

    const { data: org, error: orgError } = await supabase
        .from('organisations')
        .select('id, default_schedule, status')
        .eq('id', resolved.orgId)
        .single()

    // A failed lookup used to bounce a signed-in user to /login, where
    // middleware sent them straight back here
    if (orgError && orgError.code !== NO_ROWS) {
        throw new Error(`Failed to load organisation: ${orgError.message}`)
    }
    if (!org) redirect('/login')
    if (org.status === 'disabled') redirect('/dashboard')

    const { data: screen, error: screenError } = await supabase
        .from('screens')
        .select('id, name, pin, slides, schedule_mode, schedule')
        .eq('id', id)
        .eq('org_id', org.id)
        .single()

    // Only a genuinely missing row is a 404 — a failed query isn't
    if (screenError && screenError.code !== NO_ROWS) {
        throw new Error(`Failed to load screen ${id}: ${screenError.message}`)
    }
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
