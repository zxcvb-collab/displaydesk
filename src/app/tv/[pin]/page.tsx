import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import TVPlayer from './player'

export const dynamic = 'force-dynamic'

export default async function TVPage({ params }: { params: Promise<{ pin: string }> }) {
    const { pin } = await params
    const supabase = await createClient()

    const { data: screens, error } = await supabase.rpc('get_screen_by_pin', { p_pin: pin })
    // A failed lookup must not render as "no such PIN" — that would send a
    // correctly configured TV to the not-found screen during an outage
    if (error) throw new Error(`Failed to load screen for PIN ${pin}: ${error.message}`)

    const screen = screens?.[0]
    if (!screen) notFound()

    return (
        <TVPlayer
            pin={pin}
            initialSlides={Array.isArray(screen.slides) ? screen.slides : []}
            initialScheduleMode={screen.schedule_mode}
            initialSchedule={screen.schedule}
            initialOrgDefaultSchedule={screen.org_default_schedule}
            initialOrgStatus={screen.org_status}
        />
    )
}
