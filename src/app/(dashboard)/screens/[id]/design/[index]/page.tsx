import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveOrgId } from '@/lib/org'
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

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const resolved = await resolveOrgId(supabase, user.id)
    if (!resolved) redirect('/login')

    const { data: org } = await supabase
        .from('organisations')
        .select('id, status')
        .eq('id', resolved.orgId)
        .single()
    if (!org) redirect('/login')
    if (org.status === 'disabled') redirect('/dashboard')

    const { data: screen } = await supabase
        .from('screens')
        .select('id, name, slides')
        .eq('id', id)
        .eq('org_id', org.id)
        .single()
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

    return (
        <DesignEditor
            screenId={screen.id}
            orgId={org.id}
            slideIndex={slideIndex}
            initialDesign={initialDesign}
            initialDuration={initialDuration}
        />
    )
}
