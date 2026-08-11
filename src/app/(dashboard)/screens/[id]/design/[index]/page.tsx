import { notFound } from 'next/navigation'
import { requireActiveOrgPage } from '@/lib/org/page'
import { normalizeSlides } from '@/lib/slides'
import { emptyDesign, type DesignData } from '@/lib/design'
import DesignEditor from './design-editor'

export const dynamic = 'force-dynamic'

export default async function DesignPage({
    params,
}: {
    params: Promise<{ id: string; index: string }>
}) {
    const { id, index } = await params
    const { supabase, org } = await requireActiveOrgPage()

    const { data: screen } = await supabase
        .from('screens')
        .select('id, name, slides')
        .eq('id', id)
        .eq('org_id', org.id)
        .single()
    if (!screen) notFound()

    const slides = normalizeSlides(screen.slides)
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
