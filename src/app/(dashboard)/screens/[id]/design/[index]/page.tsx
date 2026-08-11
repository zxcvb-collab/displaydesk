import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveOrgId } from '@/lib/org'
import { NO_ROWS } from '@/lib/supabase/errors'
import { emptyDesign, type DesignData } from '@/lib/design'
import DesignEditor from './design-editor'

export const dynamic = 'force-dynamic'

export default async function DesignPage({
    params,
}: {
    params: Promise<{ id: string; index: string }>
}) {
    const { id, index } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError) throw new Error(`Could not verify your session: ${authError.message}`)
    if (!user) redirect('/login')

    const resolved = await resolveOrgId(supabase, user.id)
    if (!resolved) redirect('/login')

    const { data: org, error: orgError } = await supabase
        .from('organisations')
        .select('id, status')
        .eq('id', resolved.orgId)
        .single()
    if (orgError && orgError.code !== NO_ROWS) {
        throw new Error(`Failed to load organisation: ${orgError.message}`)
    }
    if (!org) redirect('/login')
    if (org.status === 'disabled') redirect('/dashboard')

    const { data: screen, error: screenError } = await supabase
        .from('screens')
        .select('id, name, slides')
        .eq('id', id)
        .eq('org_id', org.id)
        .single()
    // Only a genuinely missing row is a 404 — a failed query isn't
    if (screenError && screenError.code !== NO_ROWS) {
        throw new Error(`Failed to load screen ${id}: ${screenError.message}`)
    }
    if (!screen) notFound()

    const slides = Array.isArray(screen.slides) ? screen.slides : []
    const isNew = index === 'new'
    const slideIndex = isNew ? slides.length : Number(index)

    if (!isNew && (!Number.isInteger(slideIndex) || slideIndex < 0 || slideIndex >= slides.length)) {
        notFound()
    }

    const existing = isNew ? null : slides[slideIndex]
    const initialDesign: DesignData = existing?.design ?? emptyDesign()
    const initialDuration: number = existing?.duration ?? 8
    const initialName: string = existing?.name ?? ''

    return (
        <DesignEditor
            screenId={screen.id}
            orgId={org.id}
            slideIndex={slideIndex}
            isNew={isNew}
            initialDesign={initialDesign}
            initialDuration={initialDuration}
            initialName={initialName}
        />
    )
}
