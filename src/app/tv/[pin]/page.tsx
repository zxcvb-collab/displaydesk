import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import TVPlayer from './player'

export const dynamic = 'force-dynamic'

export default async function TVPage({ params }: { params: Promise<{ pin: string }> }) {
    const { pin } = await params
    const supabase = await createClient()

    const { data: screens } = await supabase.rpc('get_screen_by_pin', { p_pin: pin })
    const screen = screens?.[0]

    if (!screen) notFound()

    return (
        <TVPlayer
            pin={pin}
            initialSlides={Array.isArray(screen.slides) ? screen.slides : []}
        />
    )
}
